import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedTransaction {
  description: string;
  amount: number;
  type: "income" | "expense";
  payment_method: "pix" | "boleto" | "credito" | "debito" | "dinheiro" | "transferencia";
  payment_source: string | null;
  transaction_date: string;
  notes: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { fileId, profileId, userId } = await req.json();

    if (!fileId || !profileId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: fileId, profileId, userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update file status to processing
    await supabase
      .from("uploaded_files")
      .update({ status: "processing" })
      .eq("id", fileId);

    // Get file info from database
    const { data: fileRecord, error: fileError } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !fileRecord) {
      throw new Error("File not found in database");
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(fileRecord.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // Convert file to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const isImage = fileRecord.file_type.startsWith("image/");
    const isPdf = fileRecord.file_type === "application/pdf";

    // Prepare message content for multimodal AI
    const messageContent: any[] = [
      {
        type: "text",
        text: `Você é um especialista em análise de extratos bancários brasileiros. Analise o ${isImage ? "recibo/comprovante" : "extrato bancário PDF"} fornecido e extraia todas as transações financeiras.

Para cada transação, identifique:
1. Descrição (nome/descrição da transação)
2. Valor em reais (número positivo)
3. Tipo: "income" para receitas/créditos ou "expense" para despesas/débitos
4. Método de pagamento: "pix", "boleto", "credito", "debito", "dinheiro" ou "transferencia"
5. Fonte de pagamento (banco/cartão identificado, se houver)
6. Data da transação (formato YYYY-MM-DD)
7. Observações adicionais (se houver)

IMPORTANTE: Retorne APENAS um JSON válido com a estrutura abaixo, sem texto adicional:
{
  "transactions": [
    {
      "description": "string",
      "amount": number,
      "type": "income" | "expense",
      "payment_method": "pix" | "boleto" | "credito" | "debito" | "dinheiro" | "transferencia",
      "payment_source": "string ou null",
      "transaction_date": "YYYY-MM-DD",
      "notes": "string ou null"
    }
  ]
}`
      }
    ];

    // Add the file content
    if (isImage) {
      messageContent.push({
        type: "image_url",
        image_url: {
          url: `data:${fileRecord.file_type};base64,${base64Content}`
        }
      });
    } else if (isPdf) {
      // For PDFs, we encode as a document
      messageContent.push({
        type: "image_url",
        image_url: {
          url: `data:application/pdf;base64,${base64Content}`
        }
      });
    }

    // Call Lovable AI Gateway with multimodal content
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        await supabase
          .from("uploaded_files")
          .update({ status: "failed", error_message: "Limite de requisições excedido. Tente novamente mais tarde." })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        await supabase
          .from("uploaded_files")
          .update({ status: "failed", error_message: "Créditos de IA insuficientes." })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response from AI
    let extractedData: { transactions: ExtractedTransaction[] };
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedContent = aiContent.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.slice(7);
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      extractedData = JSON.parse(cleanedContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!extractedData.transactions || !Array.isArray(extractedData.transactions)) {
      throw new Error("Invalid response structure from AI");
    }

    // Insert transactions into database
    const transactionsToInsert = extractedData.transactions.map((t) => ({
      description: t.description,
      amount: Math.abs(t.amount),
      type: t.type,
      payment_method: t.payment_method,
      payment_source: t.payment_source,
      transaction_date: t.transaction_date,
      notes: t.notes,
      profile_id: profileId,
      user_id: userId,
    }));

    if (transactionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error(`Failed to insert transactions: ${insertError.message}`);
      }
    }

    // Update file status to completed
    await supabase
      .from("uploaded_files")
      .update({ 
        status: "completed", 
        processed_count: transactionsToInsert.length,
        error_message: null 
      })
      .eq("id", fileId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionsCount: transactionsToInsert.length,
        transactions: transactionsToInsert
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Processing error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Try to update file status to failed
    try {
      const { fileId } = await req.clone().json();
      if (fileId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("uploaded_files")
          .update({ status: "failed", error_message: errorMessage })
          .eq("id", fileId);
      }
    } catch (e) {
      console.error("Failed to update file status:", e);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
