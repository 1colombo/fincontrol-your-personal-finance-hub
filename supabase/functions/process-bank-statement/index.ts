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

// Generic error messages for client responses
const ERROR_MESSAGES = {
  UNAUTHORIZED: "Acesso não autorizado",
  FORBIDDEN: "Você não tem permissão para acessar este recurso",
  NOT_FOUND: "Arquivo não encontrado",
  PROCESSING_FAILED: "Falha ao processar o arquivo",
  RATE_LIMITED: "Limite de requisições excedido. Tente novamente mais tarde.",
  INSUFFICIENT_CREDITS: "Créditos de IA insuficientes",
  INVALID_REQUEST: "Requisição inválida",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== AUTHENTICATION: Validate JWT token =====
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's JWT to validate authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate the JWT and get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = claimsData.claims.sub;
    if (!authenticatedUserId) {
      console.error("No user ID in JWT claims");
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.UNAUTHORIZED }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== REQUEST VALIDATION =====
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileId, profileId } = await req.json();

    if (!fileId || !profileId) {
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.INVALID_REQUEST }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== AUTHORIZATION: Verify resource ownership =====
    // Check that the file belongs to the authenticated user
    const { data: fileRecord, error: fileError } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !fileRecord) {
      console.error("File not found:", fileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.NOT_FOUND }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the authenticated user owns this file
    if (fileRecord.user_id !== authenticatedUserId) {
      console.error("User", authenticatedUserId, "attempted to access file owned by", fileRecord.user_id);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.FORBIDDEN }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the profile belongs to the authenticated user
    const { data: profileRecord, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .single();

    if (profileError || !profileRecord) {
      console.error("Profile not found:", profileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.NOT_FOUND }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profileRecord.user_id !== authenticatedUserId) {
      console.error("User", authenticatedUserId, "attempted to use profile owned by", profileRecord.user_id);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.FORBIDDEN }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the authenticated user's ID instead of trusting client-provided userId
    const userId = authenticatedUserId;

    // Update file status to processing
    await supabase
      .from("uploaded_files")
      .update({ status: "processing" })
      .eq("id", fileId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(fileRecord.storage_path);

    if (downloadError || !fileData) {
      console.error("Failed to download file:", downloadError?.message);
      await supabase
        .from("uploaded_files")
        .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          .update({ status: "failed", error_message: ERROR_MESSAGES.RATE_LIMITED })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.RATE_LIMITED }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        await supabase
          .from("uploaded_files")
          .update({ status: "failed", error_message: ERROR_MESSAGES.INSUFFICIENT_CREDITS })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.INSUFFICIENT_CREDITS }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.error("AI Gateway error details:", aiResponse.status);
      await supabase
        .from("uploaded_files")
        .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      console.error("No content returned from AI");
      await supabase
        .from("uploaded_files")
        .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      await supabase
        .from("uploaded_files")
        .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!extractedData.transactions || !Array.isArray(extractedData.transactions)) {
      console.error("Invalid response structure from AI");
      await supabase
        .from("uploaded_files")
        .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
        .eq("id", fileId);
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert transactions into database using the authenticated user's ID
    const transactionsToInsert = extractedData.transactions.map((t) => ({
      description: t.description,
      amount: Math.abs(t.amount),
      type: t.type,
      payment_method: t.payment_method,
      payment_source: t.payment_source,
      transaction_date: t.transaction_date,
      notes: t.notes,
      profile_id: profileId,
      user_id: userId, // Always use authenticated user's ID
    }));

    if (transactionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        await supabase
          .from("uploaded_files")
          .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
          .eq("id", fileId);
        return new Response(
          JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Processing error:", error);
    
    // Try to update file status to failed
    try {
      const { fileId } = await req.clone().json();
      if (fileId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("uploaded_files")
          .update({ status: "failed", error_message: ERROR_MESSAGES.PROCESSING_FAILED })
          .eq("id", fileId);
      }
    } catch (e) {
      console.error("Failed to update file status:", e);
    }

    return new Response(
      JSON.stringify({ error: ERROR_MESSAGES.PROCESSING_FAILED }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
