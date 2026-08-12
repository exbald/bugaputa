import React,{createContext,useContext,useEffect,useState,useCallback} from "react";
import {api} from "./api";
type User={id:string;email:string}|null;
type Ctx={user:User;loading:boolean;logout:()=>Promise<void>;login:(e:string,p:string)=>Promise<void>;register:(e:string,p:string)=>Promise<void>};
const AuthCtx=createContext<Ctx>(null as any);
export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<User>(null);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    try{ const d=await api.me(); setUser(d.user??d); }catch{ setUser(null); } finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ refresh(); },[refresh]);
  const login=async(e:string,p:string)=>{ const d=await api.login(e,p); setUser((d as any).user??d); };
  const register=async(e:string,p:string)=>{
    const d=await api.register(e,p) as any;
    if(d && (d.user||d.email||d.id)){ setUser(d.user??d); try{ const m=await api.me() as any; setUser(m.user??m);}catch{} }
    else { try{ const l=await api.login(e,p) as any; setUser(l.user??l);}catch{} }
  };
  const logout=async()=>{ await api.logout(); setUser(null); };
  return <AuthCtx.Provider value={{user,loading,logout,login,register}}>{children}</AuthCtx.Provider>
}
export function useAuth(){ return useContext(AuthCtx); }
