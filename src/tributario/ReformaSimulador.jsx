// DESTINO: /src/tributario/ReformaSimulador.jsx
// EXCLUSIVO DO MÓDULO REFORMA. Sem dependência externa de gráficos.
import React,{useEffect,useMemo,useState} from "react";
import {calcularIbsCbs,compararSimplesDentroFora,projetarCrescimento,moeda,numero} from "./reforma-engine.js";

const box={background:"#fff",border:"1px solid #E3E7EF",borderRadius:14,padding:15};
const inp={width:"100%",boxSizing:"border-box",padding:"9px 10px",border:"1px solid #DDE3EC",borderRadius:8,fontSize:11};
const F=({t,v,s,help})=><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>{t}<input value={v} onChange={e=>s(e.target.value)} style={inp}/>{help&&<small style={{fontWeight:500,color:"#697386"}}>{help}</small>}</label>;
const K=({t,v,sub})=><div style={{background:"#F7F9FC",border:"1px solid #E6EAF0",borderRadius:12,padding:12}}><div style={{fontSize:8,color:"#697386",fontWeight:900,textTransform:"uppercase"}}>{t}</div><div style={{fontSize:18,fontWeight:900,marginTop:3}}>{v}</div>{sub&&<div style={{fontSize:8,color:"#697386",marginTop:2}}>{sub}</div>}</div>;

function BarChart({items=[]}){
 const max=Math.max(...items.map(x=>Math.max(0,Number(x.valor)||0)),1);
 return <div style={{display:"grid",gap:9,paddingTop:5}}>{items.map((x,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"130px 1fr 110px",gap:8,alignItems:"center",fontSize:9}}><b>{x.label}</b><div style={{height:18,background:"#EEF1F5",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(2,(Number(x.valor)||0)/max*100)}%`,background:x.cor||"#17233D",borderRadius:6}}/></div><b style={{textAlign:"right"}}>{moeda(x.valor)}</b></div>)}</div>
}
function LineChart({items=[]}){
 const w=620,h=190,pad=34;
 const vals=items.map(x=>Number(x.valor)||0), max=Math.max(...vals,1), min=Math.min(...vals,0), range=Math.max(1,max-min);
 const pts=items.map((x,i)=>{const px=pad+(items.length===1?0:i*(w-pad*2)/(items.length-1));const py=h-pad-((vals[i]-min)/range)*(h-pad*2);return{x:px,y:py,...x}});
 const path=pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
 return <div style={{overflowX:"auto"}}><svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",minWidth:560,height:210}}>
  {[0,.25,.5,.75,1].map((q,i)=><line key={i} x1={pad} x2={w-pad} y1={pad+q*(h-pad*2)} y2={pad+q*(h-pad*2)} stroke="#E6EAF0" strokeWidth="1"/>)}
  <path d={path} fill="none" stroke="#17233D" strokeWidth="3"/>
  {pts.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="4" fill="#FF6B4A"/><text x={p.x} y={h-9} textAnchor="middle" fontSize="9" fill="#5B667A">{p.label}</text></g>)}
 </svg></div>
}
function Donut({b2b=0,b2c=0}){
 const a=Math.max(0,Math.min(100,numero(b2b))), b=Math.max(0,Math.min(100,numero(b2c)));
 const total=a+b||100, pa=a/total*100;
 return <div style={{display:"flex",alignItems:"center",gap:18}}>
  <div style={{width:120,height:120,borderRadius:"50%",background:`conic-gradient(#17233D 0 ${pa}%,#FF6B4A ${pa}% 100%)`,position:"relative"}}><div style={{position:"absolute",inset:22,background:"#fff",borderRadius:"50%"}}/></div>
  <div style={{fontSize:10,lineHeight:1.9}}><div><span style={{display:"inline-block",width:9,height:9,background:"#17233D",borderRadius:2,marginRight:6}}/>B2B <b>{a.toFixed(1)}%</b></div><div><span style={{display:"inline-block",width:9,height:9,background:"#FF6B4A",borderRadius:2,marginRight:6}}/>B2C <b>{b.toFixed(1)}%</b></div></div>
 </div>
}

export default function ReformaSimulador({dadosIniciais={},onResultado}){
 const [fat,setFat]=useState(""),[cbs,setCbs]=useState(""),[ibs,setIbs]=useState("");
 const [redCbs,setRedCbs]=useState("0"),[redIbs,setRedIbs]=useState("0");
 const [credCbs,setCredCbs]=useState(""),[credIbs,setCredIbs]=useState("");
 const [dasDentro,setDasDentro]=useState(""),[dasFora,setDasFora]=useState("");
 const [cres,setCres]=useState("20"),[cresCred,setCresCred]=useState("20");
 const [beneficio,setBeneficio]=useState(""),[baseLegal,setBaseLegal]=useState(""),[statusBeneficio,setStatusBeneficio]=useState("POTENCIAL_VALIDAR");

 useEffect(()=>{
  if(dadosIniciais.faturamento!=null&&dadosIniciais.faturamento!=="")setFat(String(dadosIniciais.faturamento));
  if(dadosIniciais.dasAtual)setDasDentro(String(dadosIniciais.dasAtual));
  if(dadosIniciais.creditoCBS!=null)setCredCbs(String(dadosIniciais.creditoCBS||""));
  if(dadosIniciais.creditoIBS!=null)setCredIbs(String(dadosIniciais.creditoIBS||""));
  if(dadosIniciais.reducaoCBS!=null)setRedCbs(String(dadosIniciais.reducaoCBS||0));
  if(dadosIniciais.reducaoIBS!=null)setRedIbs(String(dadosIniciais.reducaoIBS||0));
 },[dadosIniciais]);

 const pars={aliquotaCBS:cbs,aliquotaIBS:ibs,reducaoCBS:redCbs,reducaoIBS:redIbs};
 const calc=useMemo(()=>calcularIbsCbs({faturamento:fat,creditoCBS:credCbs,creditoIBS:credIbs,...pars}),[fat,cbs,ibs,redCbs,redIbs,credCbs,credIbs]);
 const simples=useMemo(()=>compararSimplesDentroFora({faturamento:fat,dasDentro,dasSemIbsCbs:dasFora,cenarioRegular:{...pars,creditoCBS:credCbs,creditoIBS:credIbs}}),[fat,dasDentro,dasFora,cbs,ibs,redCbs,redIbs,credCbs,credIbs]);
 const crescimento=[0,10,20,30,50,100].map(p=>({p,...projetarCrescimento({faturamentoAtual:fat,crescimentoReceita:p,crescimentoCreditos:cresCred,creditoCBSAtual:credCbs,creditoIBSAtual:credIbs,parametros:pars})}));
 const proj=useMemo(()=>projetarCrescimento({faturamentoAtual:fat,crescimentoReceita:cres,crescimentoCreditos:cresCred,creditoCBSAtual:credCbs,creditoIBSAtual:credIbs,parametros:pars}),[fat,cres,cresCred,credCbs,credIbs,cbs,ibs,redCbs,redIbs]);
 const resultado=useMemo(()=>({parametros:{faturamento:numero(fat),aliquotaCBS:numero(cbs),aliquotaIBS:numero(ibs),reducaoCBS:numero(redCbs),reducaoIBS:numero(redIbs),creditoCBS:numero(credCbs),creditoIBS:numero(credIbs)},ibsCbs:calc,simples,crescimento:proj,beneficio:{nome:beneficio,baseLegal,status:statusBeneficio}}),[fat,cbs,ibs,redCbs,redIbs,credCbs,credIbs,calc,simples,proj,beneficio,baseLegal,statusBeneficio]);
 useEffect(()=>{onResultado?.(resultado)},[resultado,onResultado]);

 return <div style={{display:"grid",gap:11}}>
  <div style={box}><h3 style={{marginTop:0}}>Simulação financeira IBS / CBS</h3><p style={{fontSize:9,color:"#697386"}}>Preencha alíquotas somente após validação legal. Valores documentais já identificados entram automaticamente.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}><F t="Faturamento/base" v={fat} s={setFat}/><F t="CBS %" v={cbs} s={setCbs}/><F t="IBS %" v={ibs} s={setIbs}/><F t="Redução CBS %" v={redCbs} s={setRedCbs}/><F t="Redução IBS %" v={redIbs} s={setRedIbs}/><F t="Crédito CBS" v={credCbs} s={setCredCbs}/><F t="Crédito IBS" v={credIbs} s={setCredIbs}/></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginTop:12}}><K t="CBS líquida" v={moeda(calc.liquidoCBS)}/><K t="IBS líquido" v={moeda(calc.liquidoIBS)}/><K t="Total IBS + CBS" v={moeda(calc.total)}/><K t="Carga efetiva" v={`${calc.cargaEfetiva.toFixed(2)}%`}/></div>
  </div>

  <div style={box}><h3 style={{marginTop:0}}>Gráfico 1 — composição IBS/CBS</h3><BarChart items={[{label:"CBS líquida",valor:calc.liquidoCBS,cor:"#31589C"},{label:"IBS líquido",valor:calc.liquidoIBS,cor:"#FF6B4A"},{label:"Carga total",valor:calc.total,cor:"#17233D"}]}/></div>

  <div style={box}><h3 style={{marginTop:0}}>Gráfico 2 — Simples dentro x por fora</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><F t="DAS no cenário dentro" v={dasDentro} s={setDasDentro}/><F t="DAS sem IBS/CBS no cenário por fora" v={dasFora} s={setDasFora}/></div><BarChart items={[{label:"Dentro",valor:simples.dentro,cor:"#31589C"},{label:"Por fora",valor:simples.fora||0,cor:"#FF6B4A"}]}/><p style={{fontSize:10}}><b>Menor carga matemática:</b> {simples.menorCargaMatematica}</p></div>

  <div style={box}><h3 style={{marginTop:0}}>Gráfico 3 — crescimento x IBS/CBS</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><F t="Cenário selecionado %" v={cres} s={setCres}/><F t="Crescimento dos créditos %" v={cresCred} s={setCresCred}/></div><LineChart items={crescimento.map(x=>({label:x.p===0?"Atual":`+${x.p}%`,valor:x.projetado.total}))}/><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><K t="Faturamento projetado" v={moeda(proj.faturamentoProjetado)}/><K t="IBS/CBS projetado" v={moeda(proj.projetado.total)}/><K t="Aumento" v={moeda(proj.aumentoImposto)} sub={proj.aumentoImpostoPct!=null?`${proj.aumentoImpostoPct.toFixed(2)}%`:""}/></div></div>

  <div style={box}><h3 style={{marginTop:0}}>Gráfico 4 — perfil dos clientes</h3><Donut b2b={dadosIniciais.b2b} b2c={dadosIniciais.b2c}/><p style={{fontSize:9,color:"#697386"}}>Esse perfil influencia a análise de crédito, preço e competitividade. Só use B2B/B2C extraído quando houver comprovação documental.</p></div>

  <div style={box}><h3 style={{marginTop:0}}>Benefício / tratamento diferenciado</h3><div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:8}}><F t="Benefício ou tratamento" v={beneficio} s={setBeneficio}/><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>Status<select value={statusBeneficio} onChange={e=>setStatusBeneficio(e.target.value)} style={inp}><option value="POTENCIAL_VALIDAR">Potencial — validar</option><option value="APLICAVEL">Aplicável após validação</option><option value="NAO_APLICAVEL">Não aplicável</option></select></label></div><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800,marginTop:8}}>Base legal / fonte oficial<textarea rows={3} value={baseLegal} onChange={e=>setBaseLegal(e.target.value)} style={{...inp,resize:"vertical"}} placeholder="Lei, dispositivo, fonte oficial e data de verificação"/></label></div>

  <div style={box}><h3 style={{marginTop:0}}>Memória de cálculo</h3><div style={{fontSize:9.5,lineHeight:1.8}}><div>Base tributável: <b>{moeda(calc.baseTributavel)}</b></div><div>Débito CBS: <b>{moeda(calc.debitoCBS)}</b> − crédito <b>{moeda(calc.creditoCBS)}</b> = <b>{moeda(calc.liquidoCBS)}</b></div><div>Débito IBS: <b>{moeda(calc.debitoIBS)}</b> − crédito <b>{moeda(calc.creditoIBS)}</b> = <b>{moeda(calc.liquidoIBS)}</b></div><div style={{borderTop:"1px solid #E3E7EF",marginTop:6,paddingTop:6}}>Total líquido = <b>{moeda(calc.total)}</b></div></div></div>
 </div>;
}
