"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, ArrowRight, Loader2, AlertCircle } from "lucide-react";

function LogoMark() {
  return (
    <div style={{ width:48,height:48,borderRadius:13,background:"conic-gradient(from 0deg, var(--p), var(--p2), var(--acc), var(--p))",boxShadow:"0 4px 16px rgba(124,111,253,0.35)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:24,marginInline:"auto" }}>Z</div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.4-.2-2.1H12v3.9h5.9c-.1.9-.8 2.3-2.3 3.3L18 19.5c2.2-2 3.5-5 3.5-7.2z"/>
      <path fill="#34A853" d="M12 23c3.2 0 5.8-1 7.7-2.8l-3.7-2.9c-1 .7-2.3 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9l-4 3C3.4 20.5 7.4 23 12 23z"/>
      <path fill="#FBBC04" d="M5.4 13.5C5.2 12.9 5.1 12.2 5.1 11.5s.1-1.4.3-2L1.4 6.5C.5 8 0 9.7 0 11.5s.5 3.5 1.4 5l4-3z"/>
      <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l2.7-2.6C16.7 1.9 14.4 1 12 1 7.4 1 3.4 3.5 1.4 6.5l4 3C6.3 6.7 8.9 4.6 12 4.6z"/>
    </svg>
  );
}

export default function Signup() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push("/auth/signin?registered=true");
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
        <div style={{ textAlign:"center",marginBottom:28 }}>
          <LogoMark/>
          <h1 style={{ fontSize:24,fontWeight:800,letterSpacing:"-0.02em",color:"var(--t1)",marginTop:14 }}>Create account</h1>
          <p style={{ fontSize:13,color:"var(--t3)",marginTop:4 }}>Join Zynqio and start hosting quizzes</p>
        </div>

        {error && (
          <div style={{ marginBottom:18,padding:"10px 14px",borderRadius:10,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",fontSize:13,color:"var(--red)",display:"flex",gap:8,alignItems:"flex-start" }}>
            <AlertCircle size={15} style={{ flexShrink:0,marginTop:1 }}/>{error}
          </div>
        )}

        <button onClick={() => signIn("google", { callbackUrl:"/dashboard" })} className="zy-btn-ghost" style={{ width:"100%",padding:"11px",justifyContent:"center",fontSize:14 }}>
          <GoogleIcon/> Sign up with Google
        </button>

        <div style={{ display:"flex",alignItems:"center",gap:12,margin:"20px 0",color:"var(--t4)",fontSize:11,fontWeight:600,letterSpacing:"0.1em" }}>
          <div style={{ flex:1,height:1,background:"var(--border-raw)"}}/> OR <div style={{ flex:1,height:1,background:"var(--border-raw)"}}/>
        </div>

        <form onSubmit={handleSignup} style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="zy-input"/>
          <input type="text" required value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="zy-input"/>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min. 6 characters)" className="zy-input"/>
          <button type="submit" disabled={isLoading} className="zy-btn-primary" style={{ width:"100%",padding:"12px",fontSize:14,marginTop:4,opacity:isLoading?0.7:1 }}>
            {isLoading ? <Loader2 size={16} className="animate-spin"/> : <>Create account <ArrowRight size={15}/></>}
          </button>
        </form>

        <div style={{ marginTop:22,textAlign:"center",fontSize:13,color:"var(--t3)" }}>
          Already have an account?{" "}<Link href="/auth/signin" style={{ color:"var(--p2)",fontWeight:600,textDecoration:"none" }}>Sign in →</Link>
        </div>
      </div>
    </div>
  );
}
