import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoinLogo } from '@/components/ui/CoinLogo';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword']
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });
  
  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  });
  
  const handleLogin = async (data: LoginData) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRegister = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password);
      toast.success('Conta criada! Verifique seu email para confirmar o cadastro.');
      setActiveTab('login');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,hsl(230,60%,95%),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,hsl(230,40%,12%),transparent_50%)]" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex justify-center mb-4">
            <CoinLogo size="xl" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
            Nexus
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestão financeira inteligente
          </p>
        </div>

        <Card className="card-finance animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="text-center pb-4">
            <CardTitle className="font-display text-xl">Bem-vindo</CardTitle>
            <CardDescription>
              Entre na sua conta ou crie uma nova
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="transition-all duration-200">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="register" className="transition-all duration-200">
                  Criar Conta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="animate-fade-in">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField 
                      control={loginForm.control} 
                      name="email" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="seu@email.com" 
                              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={loginForm.control} 
                      name="password" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPassword ? 'text' : 'password'} 
                                placeholder="••••••••" 
                                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                {...field} 
                              />
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-0 top-0 h-full hover:bg-transparent" 
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <Button 
                      type="submit" 
                      className="w-full press-effect transition-all duration-200" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Entrando...
                        </>
                      ) : 'Entrar'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register" className="animate-fade-in">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <FormField 
                      control={registerForm.control} 
                      name="email" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="seu@email.com" 
                              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={registerForm.control} 
                      name="password" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPassword ? 'text' : 'password'} 
                                placeholder="••••••••" 
                                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                                {...field} 
                              />
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-0 top-0 h-full hover:bg-transparent" 
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={registerForm.control} 
                      name="confirmPassword" 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Senha</FormLabel>
                          <FormControl>
                            <Input 
                              type={showPassword ? 'text' : 'password'} 
                              placeholder="••••••••" 
                              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <Button 
                      type="submit" 
                      className="w-full press-effect transition-all duration-200" 
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando conta...
                        </>
                      ) : 'Criar Conta'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
