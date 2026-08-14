export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const BASE = "";
async function doFetch(path: string, opts: RequestInit = {}){
  const res = await fetch(BASE+path, {credentials:"include", ...opts, headers:{...(opts.headers as any)}});
  const text = await res.text();
  let data:any=null; try{ data=text?JSON.parse(text):null;}catch{ data=text; }
  if(!res.ok){ const msg=(data && (data.error||data.message)) || ("Request failed ("+res.status+")"); throw new ApiError(msg, res.status, data); }
  return data;
}
export const api={
  register:(email:string,password:string)=>doFetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}),
  login:(email:string,password:string)=>doFetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}),
  logout:()=>doFetch("/api/auth/logout",{method:"POST"}),
  me:()=>doFetch("/api/auth/me"),
  listProjects:()=>doFetch("/api/projects"),
  createProject:(name:string)=>doFetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})}),
  getProject:(id:string)=>doFetch("/api/projects/"+id),
  deleteProject:(id:string)=>doFetch("/api/projects/"+id,{method:"DELETE"}),
  updateProject:(id:string, data:{ widget_label?: string; widget_color?: string; widget_position?: string })=>doFetch("/api/projects/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),
  getWidgetConfig:(key:string)=>doFetch("/api/widget-config?project="+encodeURIComponent(key)),
  listReports:(projectId:string,params:Record<string,string|number>={})=>{
    const entries=Object.entries(params).filter(([,v])=>v!==""&&v!=null).map(([k,v])=>[k,String(v)] as [string,string]);
    const qs=new URLSearchParams(entries).toString();
    return doFetch("/api/projects/"+projectId+"/reports"+(qs?"?"+qs:""));
  },
  getReport:(id:string)=>doFetch("/api/reports/"+id),
  patchReport:(id:string,status:string)=>doFetch("/api/reports/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})}),
  deleteReport:(id:string)=>doFetch("/api/reports/"+id,{method:"DELETE"}),
};
