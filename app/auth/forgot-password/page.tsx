"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, ArrowRight, Loader2, AlertCircle, Check } from "lucide-react";

function LogoMark() {
  return (
    <div style={{ width:48,height:48,borderRadius:13,background:"conic-gradient(from 0deg, var(--p), var(--p2), var(--acc), var(--p))",boxShadow:"0 4px 16px rgba(124,111,253,0.35)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:24,marginInline:"auto" }}>Z</div>
  );
}

function ForgotPasswordContent() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSubmitted(true);
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
        {!submitted ? (
          <>
            <div style={{ textAlign:"center",marginBottom:28 }}>
              <LogoMark/>
              <h1 style={{ fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:"var(--t1)",marginTop:14 }}>Reset password</h1>
              <p style={{ fontSize:13,color:"var(--t3)",marginTop:4 }}>Enter your email to receive a reset link</p>
            </div>
            {error && (
              <div style={{ marginBottom:18,padding:"10px 14px",borderRadius:10,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",fontSize:13,color:"var(--red)",display:"flex",gap:8,alignItems:"flex-start" }}>
                <AlertCircle size={15} style={{ flexShrink:0,marginTop:1 }}/>{error}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="zy-input"/>
              <button type="submit" disabled={isLoading} className="zy-btn-primary" style={{ width:"100%",padding:"12px",fontSize:14,opacity:isLoading?0.7:1 }}>
                {isLoading ? <Loader2 size={16} className="animate-spin"/> : <>Send reset link <ArrowRight size={15}/></>}
              </button>
            </form>
            <div style={{ marginTop:22,textAlign:"center",fontSize:13,color:"var(--t3)" }}>
              Remember it?{" "}<Link href="/auth/signin" style={{ color:"var(--p2)",fontWeight:600,textDecoration:"none" }}>Sign in →</Link>
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center" }}>
            <div style={{ width:60,height:60,borderRadius:"50%",background:"rgba(52,211,153,0.15)",display:"flex",alignItems:"center",justifyContent:"center",marginInline:"auto",marginBottom:20 }}>
              <Check size={28} style={{ color:"var(--green)" }}/>
            </div>
            <h2 style={{ fontSize:22,fontWeight:800,color:"var(--t1)" }}>Check your email</h2>
            <p style={{ fontSize:13,color:"var(--t3)",marginTop:10,lineHeight:1.6 }}>
              We sent a reset link to <strong style={{ color:"var(--t1)" }}>{email}</strong>. Check your spam folder if you don&apos;t see it.
            </p>
            <button onClick={() => router.push("/auth/signin")} className="zy-btn-primary" style={{ width:"100%",padding:"12px",fontSize:14,marginTop:24 }}>
              Back to sign in
            </button>
            <button onClick={() => setSubmitted(false)} style={{ marginTop:14,fontSize:12,color:"var(--t3)",background:"none",border:"none",cursor:"pointer" }}>
              Try different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForgotPassword() {
  return (
    <Suspense fallback={<div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center" }}><Loader2 size={32} className="animate-spin" style={{ color:"var(--p)" }}/></div>}>
      <ForgotPasswordContent/>
    </Suspense>
  );
}
