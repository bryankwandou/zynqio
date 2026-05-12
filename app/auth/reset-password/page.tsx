"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, ArrowRight, Loader2, AlertCircle, Check } from "lucide-react";

function LogoMark() {
  return (
    <div style={{ width:48,height:48,borderRadius:13,background:"conic-gradient(from 0deg, var(--p), var(--p2), var(--acc), var(--p))",boxShadow:"0 4px 16px rgba(124,111,253,0.35)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:24,marginInline:"auto" }}>Z</div>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { theme, setTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token. Please request a new password reset.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setSuccess(true);
      setTimeout(() => router.push("/auth/signin"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position:"relative",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div className="ambient"/>
      <div style={{ position:"fixed",top:20,right:20,zIndex:100 }}>
        <button className="zy-btn-ghost" style={{ padding:"8px 10px" }} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
        </button>
      </div>
      <div className="zy-card animate-fade-up" style={{ width:"100%",maxWidth:400,padding:"36px 32px",position:"relative",zIndex:2 }}>
        {!token ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ width:56,height:56,borderRadius:14,background:"rgba(248,113,113,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginInline:"auto",marginBottom:16 }}>
              <AlertCircle size={28} style={{ color:"var(--red)" }}/>
            </div>
            <h2 style={{ fontSize:22,fontWeight:800,color:"var(--t1)" }}>Invalid link</h2>
            <p style={{ fontSize:13,color:"var(--t3)",marginTop:8,lineHeight:1.6 }}>This password reset link is invalid or has expired.</p>
            <button onClick={() => router.push("/auth/signin")} className="zy-btn-primary" style={{ width:"100%",padding:"12px",fontSize:14,marginTop:24 }}>
              Back to sign in
            </button>
          </div>
        ) : success ? (
          <div style={{ textAlign:"center" }}>
            <div style={{ width:60,height:60,borderRadius:"50%",background:"rgba(52,211,153,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginInline:"auto",marginBottom:20 }}>
              <Check size={28} style={{ color:"var(--green)" }}/>
            </div>
            <h2 style={{ fontSize:22,fontWeight:800,color:"var(--t1)" }}>Password reset!</h2>
            <p style={{ fontSize:13,color:"var(--t3)",marginTop:8 }}>Redirecting to sign in…</p>
          </div>
        ) : (
          <>
            <div style={{ textAlign:"center",marginBottom:28 }}>
              <LogoMark/>
              <h1 style={{ fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:"var(--t1)",marginTop:14 }}>Create new password</h1>
              <p style={{ fontSize:13,color:"var(--t3)",marginTop:4 }}>Enter your new password below</p>
            </div>
            {error && (
              <div style={{ marginBottom:18,padding:"10px 14px",borderRadius:10,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",fontSize:13,color:"var(--red)",display:"flex",gap:8,alignItems:"flex-start" }}>
                <AlertCircle size={15} style={{ flexShrink:0,marginTop:1 }}/>{error}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (min. 6 characters)" className="zy-input"/>
              <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="zy-input"/>
              <button type="submit" disabled={isLoading} className="zy-btn-primary" style={{ width:"100%",padding:"12px",fontSize:14,marginTop:4,opacity:isLoading?0.7:1 }}>
                {isLoading ? <Loader2 size={16} className="animate-spin"/> : <>Reset password <ArrowRight size={15}/></>}
              </button>
            </form>
            <div style={{ marginTop:22,textAlign:"center",fontSize:13,color:"var(--t3)" }}>
              <Link href="/auth/signin" style={{ color:"var(--p2)",fontWeight:600,textDecoration:"none" }}>← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center" }}><Loader2 size={32} className="animate-spin" style={{ color:"var(--p)" }}/></div>}>
      <ResetPasswordContent/>
    </Suspense>
  );
}
