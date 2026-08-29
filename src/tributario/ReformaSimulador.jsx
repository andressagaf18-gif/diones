// DESTINO: /src/tributario/ReformaSimulador.jsx
// ARQUIVO EXCLUSIVO DO MÓDULO REFORMA TRIBUTÁRIA.
import React,{useEffect,useMemo,useState} from "react";
import {calcularIbsCbs,compararSimplesDentroFora,projetarCrescimento,moeda,numero} from "./reforma-engine.js";

const box={background:"#fff",border:"1px solid #E3E7EF",borderRadius:14,padding:15};
const inp={width:"100%",boxSizing:"border-box",padding:"9px 10px",border:"1px solid #DDE3EC",borderRadius:8,fontSize:11};
const F=({t,v,s,help})=><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>{t}<input value={v} onChange={e=>s(e.target.value)} style={inp}/>{help&&<small style={{fontWeight:500,color:"#697386"}}>{help}</small>}</label>;
const K=({t,v,sub})=><div style={{background:"#F7F9FC",border:"1px solid #E6EAF0",borderRadius:12,padding:12}}><div style={{fontSize:8,color:"#697386",fontWeight:900,textTransform:"uppercase"}}>{t}</div><div style={{fontSize:18,fontWeight:900,marginTop:3}}>{v}</div>{sub&&<div style={{fontSize:8,color:"#697386",marginTop:2}}>{sub}</div>}</div>;
const Bar=({label,value,max})=><div style={{display:"grid",gridTemplateColumns:"120px 1fr 95px",gap:8,alignItems:"center",fontSize:9}}><b>{label}</b><div style={{height:11,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${max?Math.min(100,Math.max(0,value/max*100)):0}%`,background:"#17233D"}}/></div><b style={{textAlign:"right"}}>{moeda(value)}</b></div>;

export default function ReformaSimulador({dadosIniciais={},onResultado}){
 const [fat,setFat]=useState(""),[cbs,setCbs]=useState(""),[ibs,setIbs]=useState("");
 const [redCbs,setRedCbs]=useState("0"),[redIbs,setRedIbs]=useState("0");
 const [credCbs,setCredCbs]=useState(""),[credIbs,setCredIbs]=useState("");
 const [dasDentro,setDasDentro]=useState(""),[dasFora,setDasFora]=useState("");
 const [cres,setCres]=useState("20"),[cresCred,setCresCred]=useState("20");
 const [beneficio,setBeneficio]=useState(""),[baseLegal,setBaseLegal]=useState(""),[statusBeneficio,setStatusBeneficio]=useState("POTENCIAL_VALIDAR");

 useEffect(()=>{
  if(dadosIniciais.faturamento!=null&&dadosIniciais.faturamento!=="")setFat(String(dadosIniciais.faturamento));
  if(dadosIniciais.creditoCBS!=null)setCredCbs(String(dadosIniciais.creditoCBS||""));
  if(dadosIniciais.creditoIBS!=null)setCredIbs(String(dadosIniciais.creditoIBS||""));
  if(dadosIniciais.reducaoCBS!=null)setRedCbs(String(dadosIniciais.reducaoCBS||0));
  if(dadosIniciais.reducaoIBS!=null)setRedIbs(String(dadosIniciais.reducaoIBS||0));
 },[dadosIniciais.faturamento,dadosIniciais.creditoCBS,dadosIniciais.creditoIBS,dadosIniciais.reducaoCBS,dadosIniciais.reducaoIBS]);

 const pars={aliquotaCBS:cbs,aliquotaIBS:ibs,reducaoCBS:redCbs,reducaoIBS:redIbs};
 const calc=useMemo(()=>calcularIbsCbs({faturamento:fat,creditoCBS:credCbs,creditoIBS:credIbs,...pars}),[fat,cbs,ibs,redCbs,redIbs,credCbs,credIbs]);
 const simples=useMemo(()=>compararSimplesDentroFora({faturamento:fat,dasDentro,dasSemIbsCbs:dasFora,cenarioRegular:{...pars,creditoCBS:credCbs,creditoIBS:credIbs}}),[fat,dasDentro,dasFora,cbs,ibs,redCbs,redIbs,credCbs,credIbs]);
 const proj=useMemo(()=>projetarCrescimento({faturamentoAtual:fat,crescimentoReceita:cres,crescimentoCreditos:cresCred,creditoCBSAtual:credCbs,creditoIBSAtual:credIbs,parametros:pars}),[fat,cres,cresCred,credCbs,credIbs,cbs,ibs,redCbs,redIbs]);

 const resultado=useMemo(()=>({parametros:{faturamento:numero(fat),aliquotaCBS:numero(cbs),aliquotaIBS:numero(ibs),reducaoCBS:numero(redCbs),reducaoIBS:numero(redIbs),creditoCBS:numero(credCbs),creditoIBS:numero(credIbs)},ibsCbs:calc,simples,crescimento:proj,beneficio:{nome:beneficio,baseLegal,status:statusBeneficio}}),[fat,cbs,ibs,redCbs,redIbs,credCbs,credIbs,calc,simples,proj,beneficio,baseLegal,statusBeneficio]);
 useEffect(()=>{onResultado?.(resultado)},[resultado,onResultado]);

 const max=Math.max(calc.liquidoCBS,calc.liquidoIBS,calc.total,simples.dentro,simples.fora||0,proj.projetado.total,1);
 return <div style={{display:"grid",gap:11}}>
  <div style={box}>
   <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start"}}><div><h3 style={{margin:"0 0 4px"}}>Simulação financeira IBS / CBS</h3><p style={{fontSize:9,color:"#697386",margin:0}}>O cálculo é determinístico. A IA não calcula imposto; ela fornece a base que será validada.</p></div><span style={{background:"#E9F7EF",color:"#176B47",padding:"5px 8px",borderRadius:999,fontSize:8,fontWeight:900}}>MEMÓRIA AUDITÁVEL</span></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginTop:12}}>
    <F t="Faturamento/base da simulação" v={fat} s={setFat}/>
    <F t="CBS %" v={cbs} s={setCbs} help="Parâmetro legal validado"/>
    <F t="IBS %" v={ibs} s={setIbs} help="Parâmetro legal validado"/>
    <F t="Redução CBS %" v={redCbs} s={setRedCbs}/>
    <F t="Redução IBS %" v={redIbs} s={setRedIbs}/>
    <F t="Crédito CBS" v={credCbs} s={setCredCbs}/>
    <F t="Crédito IBS" v={credIbs} s={setCredIbs}/>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,marginTop:12}}>
    <K t="CBS líquida" v={moeda(calc.liquidoCBS)}/><K t="IBS líquido" v={moeda(calc.liquidoIBS)}/><K t="Total IBS + CBS" v={moeda(calc.total)}/><K t="Carga efetiva" v={`${calc.cargaEfetiva.toFixed(2)}%`}/>
   </div>
  </div>

  <div style={box}><h3 style={{marginTop:0}}>Gráfico — composição da nova carga</h3><div style={{display:"grid",gap:8}}><Bar label="CBS líquida" value={calc.liquidoCBS} max={max}/><Bar label="IBS líquido" value={calc.liquidoIBS} max={max}/><Bar label="Total" value={calc.total} max={max}/></div></div>

  <div style={box}><h3 style={{marginTop:0}}>Simples Nacional — dentro x por fora</h3>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><F t="DAS no cenário 'dentro'" v={dasDentro} s={setDasDentro}/><F t="DAS sem IBS/CBS no cenário 'por fora'" v={dasFora} s={setDasFora}/></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}><K t="Dentro" v={moeda(simples.dentro)}/><K t="Por fora" v={simples.fora==null?"Pendente":moeda(simples.fora)}/><K t="Menor carga matemática" v={simples.menorCargaMatematica}/></div>
   <div style={{display:"grid",gap:8,marginTop:12}}><Bar label="Simples dentro" value={simples.dentro} max={max}/><Bar label="Simples por fora" value={simples.fora||0} max={max}/></div>
   <p style={{fontSize:9,color:"#697386"}}>A menor carga matemática não vira recomendação automática. O diagnóstico deve ponderar B2B/B2C, créditos, preço, margem, caixa, operação e requisitos legais.</p>
  </div>

  <div style={box}><h3 style={{marginTop:0}}>Cenário de crescimento</h3>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><F t="Crescimento da receita %" v={cres} s={setCres}/><F t="Crescimento dos créditos %" v={cresCred} s={setCresCred}/></div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:10}}><K t="Faturamento projetado" v={moeda(proj.faturamentoProjetado)}/><K t="IBS/CBS projetado" v={moeda(proj.projetado.total)}/><K t="Aumento do imposto" v={moeda(proj.aumentoImposto)} sub={proj.aumentoImpostoPct!=null?`${proj.aumentoImpostoPct.toFixed(2)}%`:""}/></div>
   <div style={{display:"grid",gap:8,marginTop:12}}><Bar label="Carga atual" value={proj.atual.total} max={max}/><Bar label={`Carga +${cres||0}%`} value={proj.projetado.total} max={max}/></div>
  </div>

  <div style={box}><h3 style={{marginTop:0}}>Benefício / tratamento diferenciado</h3>
   <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:8}}><F t="Benefício ou tratamento" v={beneficio} s={setBeneficio}/><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>Status<select value={statusBeneficio} onChange={e=>setStatusBeneficio(e.target.value)} style={inp}><option value="POTENCIAL_VALIDAR">Potencial — validar</option><option value="APLICAVEL">Aplicável após validação</option><option value="NAO_APLICAVEL">Não aplicável</option></select></label></div>
   <label style={{display:"grid",gap:4,fontSize:9,fontWeight:800,marginTop:8}}>Base legal / fonte oficial<textarea rows={3} value={baseLegal} onChange={e=>setBaseLegal(e.target.value)} style={{...inp,resize:"vertical"}} placeholder="Lei, artigo/dispositivo, ato, fonte oficial e data de verificação"/></label>
   <p style={{fontSize:9,color:"#697386"}}>O sistema não deve considerar redução/benefício no cálculo sem validação do responsável e fundamento jurídico registrado.</p>
  </div>

  <div style={box}><h3 style={{marginTop:0}}>Memória de cálculo</h3>
   <div style={{fontSize:9.5,lineHeight:1.8}}>
    <div>Base tributável: <b>{moeda(calc.baseTributavel)}</b></div>
    <div>Débito CBS: base × alíquota efetiva = <b>{moeda(calc.debitoCBS)}</b></div>
    <div>(−) Crédito CBS = <b>{moeda(calc.creditoCBS)}</b></div>
    <div>Débito IBS: base × alíquota efetiva = <b>{moeda(calc.debitoIBS)}</b></div>
    <div>(−) Crédito IBS = <b>{moeda(calc.creditoIBS)}</b></div>
    <div style={{borderTop:"1px solid #E3E7EF",marginTop:6,paddingTop:6}}>IBS + CBS líquido = <b>{moeda(calc.total)}</b></div>
   </div>
  </div>
 </div>;
}
