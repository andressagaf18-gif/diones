// DESTINO: /src/tributario/ReformaSimulador.jsx
// NOVO COMPONENTE ISOLADO. USAR SOMENTE NA REFORMA TRIBUTÁRIA.
import React,{useMemo,useState} from "react";
import {calcularIbsCbs,compararSimplesDentroFora,projetarCrescimento,moeda} from "./reforma-engine.js";
const box={background:"#fff",border:"1px solid #E3E7EF",borderRadius:12,padding:14};
const inp={width:"100%",boxSizing:"border-box",padding:"8px 9px",border:"1px solid #DDE3EC",borderRadius:8};
const F=({t,v,s})=><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800}}>{t}<input value={v} onChange={e=>s(e.target.value)} style={inp}/></label>;
export default function ReformaSimulador(){
 const [fat,setFat]=useState(""),[cbs,setCbs]=useState(""),[ibs,setIbs]=useState("");
 const [redCbs,setRedCbs]=useState("0"),[redIbs,setRedIbs]=useState("0");
 const [credCbs,setCredCbs]=useState(""),[credIbs,setCredIbs]=useState("");
 const [dasDentro,setDasDentro]=useState(""),[dasFora,setDasFora]=useState("");
 const [cres,setCres]=useState("20"),[cresCred,setCresCred]=useState("20");
 const pars={aliquotaCBS:cbs,aliquotaIBS:ibs,reducaoCBS:redCbs,reducaoIBS:redIbs};
 const calc=useMemo(()=>calcularIbsCbs({faturamento:fat,creditoCBS:credCbs,creditoIBS:credIbs,...pars}),[fat,cbs,ibs,redCbs,redIbs,credCbs,credIbs]);
 const simples=useMemo(()=>compararSimplesDentroFora({faturamento:fat,dasDentro,dasSemIbsCbs:dasFora,cenarioRegular:{...pars,creditoCBS:credCbs,creditoIBS:credIbs}}),[fat,dasDentro,dasFora,cbs,ibs,redCbs,redIbs,credCbs,credIbs]);
 const proj=useMemo(()=>projetarCrescimento({faturamentoAtual:fat,crescimentoReceita:cres,crescimentoCreditos:cresCred,creditoCBSAtual:credCbs,creditoIBSAtual:credIbs,parametros:pars}),[fat,cres,cresCred,credCbs,credIbs,cbs,ibs,redCbs,redIbs]);
 return <div style={{display:"grid",gap:10}}>
  <div style={box}><h3>Simulador IBS / CBS</h3><p style={{fontSize:9,color:"#697386"}}>Nenhuma alíquota ou benefício é presumido. Use parâmetros validados para a empresa e data-base.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><F t="Faturamento" v={fat} s={setFat}/><F t="CBS %" v={cbs} s={setCbs}/><F t="IBS %" v={ibs} s={setIbs}/><F t="Redução CBS %" v={redCbs} s={setRedCbs}/><F t="Redução IBS %" v={redIbs} s={setRedIbs}/><F t="Crédito CBS" v={credCbs} s={setCredCbs}/><F t="Crédito IBS" v={credIbs} s={setCredIbs}/></div>
   <p><b>CBS:</b> {moeda(calc.liquidoCBS)} · <b>IBS:</b> {moeda(calc.liquidoIBS)} · <b>Total:</b> {moeda(calc.total)} · <b>Carga:</b> {calc.cargaEfetiva.toFixed(2)}%</p>
  </div>
  <div style={box}><h3>Simples — dentro x por fora</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><F t="DAS no cenário dentro" v={dasDentro} s={setDasDentro}/><F t="DAS sem IBS/CBS no cenário por fora" v={dasFora} s={setDasFora}/></div>
   <p><b>Dentro:</b> {moeda(simples.dentro)} · <b>Por fora:</b> {simples.fora==null?"Informe o DAS sem IBS/CBS":moeda(simples.fora)} · <b>Menor carga matemática:</b> {simples.menorCargaMatematica}</p>
   <small>Menor carga matemática não significa recomendação automática. Validar créditos, B2B/B2C, preço, operação e requisitos legais.</small>
  </div>
  <div style={box}><h3>Crescimento</h3><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><F t="Crescimento da receita %" v={cres} s={setCres}/><F t="Crescimento dos créditos %" v={cresCred} s={setCresCred}/></div>
   <p><b>Faturamento projetado:</b> {moeda(proj.faturamentoProjetado)} · <b>IBS/CBS projetado:</b> {moeda(proj.projetado.total)} · <b>Aumento:</b> {moeda(proj.aumentoImposto)} {proj.aumentoImpostoPct!=null?`(${proj.aumentoImpostoPct.toFixed(2)}%)`:""}</p>
  </div>
 </div>;
}
