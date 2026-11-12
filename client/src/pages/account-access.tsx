import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BrandMark from "@/components/layout/brand-mark";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { completeAccountLinkSchema } from "@shared/account-access";

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudo completar la solicitud. Volvé a intentar.");
  return data;
}

export default function AccountAccessPage() {
  const recovery = window.location.pathname === "/forgot-password";
  const invitation = window.location.pathname === "/accept-invitation";
  const purpose = invitation ? "invitation" : "password_reset";
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<{ email: string; firstName: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(!recovery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [verifyAttempt, setVerifyAttempt] = useState(0);

  useEffect(() => {
    if (recovery) return;
    let active = true;
    setVerifying(true);
    setError("");
    post("/api/account-links/validate", { token, purpose })
      .then(data => { if (active) setAccount(data); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setVerifying(false); });
    return () => { active = false; };
  }, [recovery, token, purpose, verifyAttempt]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!recovery) {
      const parsed = completeAccountLinkSchema.safeParse({ token, purpose, password, confirmPassword });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    }
    setBusy(true);
    try {
      await post(recovery ? "/api/forgot-password" : "/api/account-links/complete", recovery ? { email } : { token, purpose, password, confirmPassword });
      if (!recovery) {
        window.history.replaceState(null, "", window.location.pathname);
        setPassword(""); setConfirmPassword("");
      }
      setSuccess(true);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo completar la solicitud."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-[100dvh] bg-[#080c13] px-4 py-10 flex flex-col items-center justify-center gap-8">
    <BrandMark />
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{success ? recovery ? "Revisá tu correo" : "Tu contraseña está lista" : recovery ? "Recuperá tu acceso" : invitation ? "Te damos la bienvenida a Mind" : "Elegí una nueva contraseña"}</CardTitle>
        <CardDescription>{success ? recovery ? "Si el correo corresponde a una cuenta activa, recibirás un enlace válido por una hora. Revisá también Spam." : "Ya podés ingresar con tu email y la contraseña que elegiste." : recovery ? "Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña." : "Definí tu contraseña personal para ingresar de forma segura."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {verifying ? <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" />Verificando enlace…</p> : success ? <div className="space-y-5">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          <Button className="w-full" onClick={() => window.location.assign("/auth")}>Volver a ingresar</Button>
        </div> : recovery || account ? <form onSubmit={submit} className="space-y-5">
          {recovery ? <div className="space-y-2"><Label htmlFor="recovery-email">Email de trabajo</Label><Input id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={255} required /></div> : <>
            <p className="text-sm break-words">Hola {account?.firstName}. Tu email de acceso es <strong>{account?.email}</strong>.</p>
            <div className="space-y-2"><Label htmlFor="new-password">Nueva contraseña</Label><div className="relative"><Input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={event => { setPassword(event.target.value); setError(""); }} minLength={10} maxLength={128} className="pr-11" aria-describedby="password-hint" required /><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><p id="password-hint" className="text-xs text-muted-foreground">Usá entre 10 y 128 caracteres.</p></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Repetí la contraseña</Label><Input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={event => { setConfirmPassword(event.target.value); setError(""); }} maxLength={128} required /></div>
          </>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{recovery ? "Enviando…" : "Guardando…"}</> : recovery ? "Enviar enlace de recuperación" : "Guardar mi contraseña"}</Button>
        </form> : <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => setVerifyAttempt(value => value + 1)}>Volver a verificar</Button>
          <Link href="/forgot-password" className="block text-center text-sm text-primary underline">Solicitar un nuevo enlace</Link>
        </div>}
        {!success && <Link href="/auth" className="block text-center text-sm text-muted-foreground underline">Volver al inicio de sesión</Link>}
      </CardContent>
    </Card>
  </main>;
}
