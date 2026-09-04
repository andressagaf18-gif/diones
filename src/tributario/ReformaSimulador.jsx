// DESTINO REAL: /src/tributario/ReformaSimulador.jsx
// Simulador Reforma V4 — carga completa + DAS documental + Simples dentro/fora + transição.
import React,{useEffect,useMemo,useState} from "react";
import {ANOS_TRANSICAO,calcularCargaCompleta,moeda,numero} from "./reforma-engine.js";

const C={navy:"#17233D",blue:"#31589C",coral:"#FF6B4A",muted:"#687386",border:"#E3E7EF",bg:"#F6F8FC",green:"#0F6E56",amber:"#855A12",red:"#A33A2B"};
const box={background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:16};
const inp={width:"100%",boxSizing:"border-box",padding:"9px 10px",border:"1px solid #DDE3EC",borderRadius:8,fontSize:11,color:C.navy,background:"#fff"};
// auto-fit evita que cartões e campos sejam cortados em telas estreitas.
const grid=(n=3)=>({display:"grid",gridTemplateColumns:`repeat(auto-fit,minmax(${n>=5?"125px":"145px"},1fr))`,gap:8});
const fmtPct=v=>`${numero(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`;

function F({t,v,s,help,type="input",children}){
 return <label style={{display:"grid",gap:4,fontSize:9,fontWeight:800,color:C.navy}}>{t}
  {type==="select"?<select value={v} onChange={e=>s(e.target.value)} style={inp}>{children}</select>:<input value={v} onChange={e=>s(e.target.value)} style={inp}/>} 
  {help&&<small style={{fontWeight:500,color:C.muted,lineHeight:1.35}}>{help}</small>}
 </label>;
}
function K({t,v,sub,tone="default"}){
 const colors={default:C.navy,green:C.green,amber:C.amber,red:C.red};
 return <div style={{background:"#F7F9FC",border:`1px solid ${C.border}`,borderRadius:12,padding:12,minWidth:0}}>
  <div style={{fontSize:8,color:C.muted,fontWeight:900,textTransform:"uppercase"}}>{t}</div>
  <div style={{fontSize:18,fontWeight:900,marginTop:3,color:colors[tone]||C.navy,overflowWrap:"anywhere"}}>{v}</div>
  {sub&&<div style={{fontSize:8,color:C.muted,marginTop:3,lineHeight:1.35}}>{sub}</div>}
 </div>;
}
function SectionTitle({children,sub}){return <div style={{marginBottom:10}}><h3 style={{margin:"0 0 3px",fontFamily:"Georgia,serif",fontSize:18}}>{children}</h3>{sub&&<div style={{fontSize:9,color:C.muted}}>{sub}</div>}</div>}
function BarChart({items=[]}){
 const max=Math.max(...items.map(x=>Math.max(0,numero(x.valor))),1);
 return <div style={{display:"grid",gap:8}}>{items.map((x,i)=><div key={`${x.label}-${i}`} style={{display:"grid",gridTemplateColumns:"minmax(75px,140px) minmax(55px,1fr) minmax(76px,115px)",gap:8,alignItems:"center",fontSize:9,minWidth:0}}>
  <b>{x.label}</b><div style={{height:18,background:"#EEF1F5",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(x.valor?2:0,numero(x.valor)/max*100)}%`,background:x.cor||C.navy,borderRadius:6}}/></div><b style={{textAlign:"right"}}>{moeda(x.valor)}</b>
 </div>)}</div>;
}
function Linha({nome,valor,nota,destaque=false}){return <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(90px,150px)",gap:8,padding:"7px 8px",borderTop:`1px solid ${C.border}`,background:destaque?"#EEF4FF":"transparent",fontSize:9.5,minWidth:0}}><span style={{minWidth:0,overflowWrap:"anywhere"}}>{nome}{nota&&<small style={{display:"block",color:C.muted}}>{nota}</small>}</span><b style={{textAlign:"right",overflowWrap:"anywhere"}}>{valor}</b></div>}
function Tabela({children,minWidth=860}){return <div style={{width:"100%",overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{width:"100%",minWidth,borderCollapse:"collapse",fontSize:9.2}}>{children}</table></div>}
const TH=({children,left=false})=><th style={{background:C.navy,color:"#fff",padding:"8px 7px",textAlign:left?"left":"right",whiteSpace:"nowrap"}}>{children}</th>;
const TD=({children,left=false,bold=false,tone})=><td style={{padding:"7px",textAlign:left?"left":"right",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",fontWeight:bold?900:500,color:tone?C[tone]:C.navy}}>{children}</td>;

export default function ReformaSimulador({dadosIniciais={},onResultado}){
 const inicial=dadosIniciais.componentesDas||{};
 const [regime,setRegime]=useState(dadosIniciais.regime||"SIMPLES_NACIONAL");
 const [ano,setAno]=useState("2026");
 const [fat,setFat]=useState("");
 const [base,setBase]=useState("");
 const [meses,setMeses]=useState("1");
 const [cbs,setCbs]=useState(""),[ibs,setIbs]=useState("");
 const [redCbs,setRedCbs]=useState(String(dadosIniciais.reducaoCBS||0));
 const [redIbs,setRedIbs]=useState(String(dadosIniciais.reducaoIBS||0));
 const [credCbs,setCredCbs]=useState(String(dadosIniciais.creditoCBS||""));
 const [credIbs,setCredIbs]=useState(String(dadosIniciais.creditoIBS||""));
 const [das,setDas]=useState(String(dadosIniciais.dasAtual||""));
 const [foraSimples,setForaSimples]=useState(false);
 const [foraDas,setForaDas]=useState(String(dadosIniciais.tributosForaDas||""));
 const [seletivo,setSeletivo]=useState("");
 const [manterIpi,setManterIpi]=useState(false);
 const [dispensa2026,setDispensa2026]=useState(true);
 const [crescimento,setCrescimento]=useState("20");
 const [presIrpj,setPresIrpj]=useState("8"),[presCsll,setPresCsll]=useState("12");
 const [lucro,setLucro]=useState(""),[adicoes,setAdicoes]=useState(""),[exclusoes,setExclusoes]=useState(""),[prejuizo,setPrejuizo]=useState("");
 const [beneficio,setBeneficio]=useState(""),[baseLegal,setBaseLegal]=useState(""),[statusBeneficio,setStatusBeneficio]=useState("POTENCIAL_VALIDAR");
 const [trib,setTrib]=useState({
  pis:String(inicial.pis||""),cofins:String(inicial.cofins||""),icms:String(inicial.icms||""),iss:String(inicial.iss||""),
  ipi:String(inicial.ipi||""),cpp:String(inicial.cpp||""),irpj:String(inicial.irpj||""),adicionalIrpj:"",
  csll:String(inicial.csll||""),outros:String(inicial.outros||"")
 });
 const setT=(k,v)=>setTrib(a=>({...a,[k]:v}));

 useEffect(()=>{
  if(dadosIniciais.faturamento!=null&&dadosIniciais.faturamento!==""){
   setFat(String(dadosIniciais.faturamento));setBase(String(dadosIniciais.faturamento));
  }
 },[dadosIniciais.faturamento]);

 const parametros=useMemo(()=>({
  regime,ano,faturamento:fat,baseTributavel:base||fat,mesesPeriodo:meses,
  aliquotaCBS:cbs,aliquotaIBS:ibs,reducaoCBS:redCbs,reducaoIBS:redIbs,creditoCBS:credCbs,creditoIBS:credIbs,
  tributosAtuais:{...trib,das},componentesDas:{...trib},tributosForaDas:foraDas,
  impostoSeletivo:seletivo,manterIpiApos2027:manterIpi,
  ibsCbsForaDoSimples:foraSimples,dispensaTeste2026:dispensa2026,
  presuncaoIrpj:presIrpj,presuncaoCsll:presCsll,lucroAntesIrpjCsll:lucro,adicoes,exclusoes,prejuizoFiscalCompensavel:prejuizo
 }),[regime,ano,fat,base,meses,cbs,ibs,redCbs,redIbs,credCbs,credIbs,trib,das,foraDas,seletivo,manterIpi,foraSimples,dispensa2026,presIrpj,presCsll,lucro,adicoes,exclusoes,prejuizo]);
 const calc=useMemo(()=>calcularCargaCompleta(parametros),[parametros]);
 const simples=calc.simples||{dentro:0,fora:null,menorCargaMatematica:"NAO_CALCULAVEL"};

 const componentesDas=useMemo(()=>({
  irpj:numero(trib.irpj),adicionalIrpj:numero(trib.adicionalIrpj),csll:numero(trib.csll),
  cofins:numero(trib.cofins),pis:numero(trib.pis),cpp:numero(trib.cpp),
  icms:numero(trib.icms),ipi:numero(trib.ipi),iss:numero(trib.iss),outros:numero(trib.outros)
 }),[trib]);
 const somaComponentesDas=useMemo(()=>Object.values(componentesDas).reduce((a,b)=>a+b,0),[componentesDas]);
 const dasConciliado=numero(das)>0&&somaComponentesDas>0&&Math.abs(numero(das)-somaComponentesDas)<=.05;

 // Usa o mesmo motor da tela para cada ano. Assim tabela e relatório recebem os mesmos números.
 const transicao=useMemo(()=>ANOS_TRANSICAO.map(anoLinha=>{
  const carga=calcularCargaCompleta({...parametros,ano:String(anoLinha)});
  const s=carga.simples||{};
  const dentro=numero(s.dentro);
  const fora=s.fora==null?null:numero(s.fora);
  const diferenca=fora==null?null:fora-dentro;
  return {ano:numero(anoLinha),carga,dentro,fora,diferenca,
   menor:fora==null?"PENDENTE":fora<dentro?"POR_FORA":fora>dentro?"POR_DENTRO":"EMPATE"};
 }),[parametros]);

 const escala=1+numero(crescimento)/100;
 const proj=useMemo(()=>calcularCargaCompleta({
  ...parametros,faturamento:numero(fat)*escala,baseTributavel:numero(base||fat)*escala,
  creditoCBS:numero(credCbs)*escala,creditoIBS:numero(credIbs)*escala,
  lucroAntesIrpjCsll:numero(lucro)*escala,adicoes:numero(adicoes)*escala,exclusoes:numero(exclusoes)*escala,
  tributosAtuais:Object.fromEntries(Object.entries({...trib,das}).map(([k,v])=>[k,numero(v)*escala])),
  componentesDas:Object.fromEntries(Object.entries(trib).map(([k,v])=>[k,numero(v)*escala])),
  tributosForaDas:numero(foraDas)*escala,impostoSeletivo:numero(seletivo)*escala
 }),[parametros,fat,base,credCbs,credIbs,lucro,adicoes,exclusoes,trib,das,foraDas,seletivo,escala]);

 const resultado=useMemo(()=>({
  parametros:{...parametros,faturamento:numero(fat),ano:numero(ano)},
  ibsCbs:calc.ibsCbs,
  simples,
  cargaCompleta:calc,
  crescimento:{atual:calc,projetado:proj,faturamentoProjetado:numero(fat)*escala,aumentoImposto:proj.totalProjetado-calc.totalProjetado,
   aumentoImpostoPct:calc.totalProjetado?((proj.totalProjetado/calc.totalProjetado)-1)*100:null},
  beneficio:{nome:beneficio,baseLegal,status:statusBeneficio}
  ,composicaoDas:{componentes:componentesDas,total:somaComponentesDas,dasInformado:numero(das),conciliado:dasConciliado}
  ,transicao
 }),[parametros,fat,ano,calc,simples,proj,escala,beneficio,baseLegal,statusBeneficio,componentesDas,somaComponentesDas,das,dasConciliado,transicao]);
 useEffect(()=>{onResultado?.(resultado)},[resultado,onResultado]);

 const totalNovo=regime==="SIMPLES_NACIONAL"?(foraSimples?simples.fora:simples.dentro):calc.totalProjetado;
 const totalNovoExibido=numero(ano)>2026&&!calc.comparavel?null:totalNovo;
 const tom=calc.diferenca==null?"amber":calc.diferenca<=0?"green":"red";
 const tituloNovo=ano==="2026"?"Carga total em 2026":"Carga total projetada";

 return <div style={{display:"grid",gap:12,color:C.navy}}>
  <div style={{...box,background:`linear-gradient(135deg,${C.navy},#24385F)`,color:"#fff"}}>
   <div style={{fontSize:8,fontWeight:900,color:"#AFC5EE",letterSpacing:.7}}>SIMULADOR REFORMA · CARGA COMPLETA</div>
   <h2 style={{fontFamily:"Georgia,serif",margin:"5px 0",fontSize:24}}>Simulação tributária por regime e transição</h2>
   <div style={{fontSize:9.5,color:"#DCE6F6",lineHeight:1.5}}>IBS e CBS são apenas uma parte da análise. Este quadro soma tributos do consumo, IRPJ, adicional, CSLL, folha, DAS residual e demais incidências informadas.</div>
  </div>

  <div style={box}><SectionTitle sub="Selecione o enquadramento e o período. Não compare a fase de teste de 2026 com a carga definitiva.">1. Cenário</SectionTitle>
   <div style={grid(4)}>
    <F t="Regime tributário" v={regime} s={setRegime} type="select"><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option></F>
    <F t="Ano da transição" v={ano} s={setAno} type="select">{ANOS_TRANSICAO.map(a=><option key={a}>{a}</option>)}</F>
    <F t="Faturamento do período" v={fat} s={setFat}/><F t="Meses do período" v={meses} s={setMeses} help="Usado no limite do adicional de IRPJ."/>
   </div>
   <div style={{marginTop:10,padding:"9px 11px",borderRadius:9,background:"#EEF4FF",fontSize:9}}><b>{calc.regra.fase}:</b> {ano==="2026"?"CBS 0,9% e IBS 0,1% são alíquotas de teste. A carga atual continua sendo demonstrada.":`Aplicação do cronograma selecionado para ${ano}.`}</div>
  </div>

  <div style={box}><SectionTitle sub="Informe valores do mesmo período do faturamento. Documentos extraídos podem preencher estes campos.">2. Tributos atuais</SectionTitle>
   {regime==="SIMPLES_NACIONAL"&&<div style={{...grid(3),marginBottom:9}}><F t="DAS atual completo" v={das} s={setDas}/><F t="Tributos fora do DAS" v={foraDas} s={setForaDas} help="ST, DIFAL, antecipação, retenções e outras guias."/><F t="IBS/CBS no cenário" v={foraSimples?"FORA_DO_SIMPLES":"DENTRO_DO_SIMPLES"} s={v=>setForaSimples(v==="FORA_DO_SIMPLES")} type="select"><option value="DENTRO_DO_SIMPLES">Dentro do Simples</option><option value="FORA_DO_SIMPLES">Regime regular — por fora</option></F></div>}
   <div style={grid(5)}>
    <F t="PIS" v={trib.pis} s={v=>setT("pis",v)}/><F t="Cofins" v={trib.cofins} s={v=>setT("cofins",v)}/><F t="ICMS" v={trib.icms} s={v=>setT("icms",v)}/><F t="ISS" v={trib.iss} s={v=>setT("iss",v)}/><F t="IPI" v={trib.ipi} s={v=>setT("ipi",v)}/>
    <F t="CPP/folha" v={trib.cpp} s={v=>setT("cpp",v)}/><F t="IRPJ atual" v={trib.irpj} s={v=>setT("irpj",v)}/><F t="Adicional IRPJ" v={trib.adicionalIrpj} s={v=>setT("adicionalIrpj",v)}/><F t="CSLL atual" v={trib.csll} s={v=>setT("csll",v)}/><F t="Outros" v={trib.outros} s={v=>setT("outros",v)}/>
   </div>
  </div>

  {regime==="LUCRO_PRESUMIDO"&&<div style={box}><SectionTitle sub="IRPJ e CSLL são calculados pelas bases presumidas, não diretamente pela alíquota sobre todo o faturamento.">3. Particularidades do Lucro Presumido</SectionTitle><div style={grid(2)}><F t="Presunção IRPJ %" v={presIrpj} s={setPresIrpj}/><F t="Presunção CSLL %" v={presCsll} s={setPresCsll}/></div></div>}
  {regime==="LUCRO_REAL"&&<div style={box}><SectionTitle sub="IRPJ e CSLL incidem sobre o lucro fiscal positivo. Prejuízo no período zera esses tributos.">3. Particularidades do Lucro Real</SectionTitle><div style={grid(4)}><F t="Lucro/prejuízo antes de IRPJ/CSLL" v={lucro} s={setLucro}/><F t="Adições fiscais" v={adicoes} s={setAdicoes}/><F t="Exclusões fiscais" v={exclusoes} s={setExclusoes}/><F t="Prejuízo fiscal compensável" v={prejuizo} s={setPrejuizo} help="O motor limita a compensação a 30% da base positiva."/></div></div>}

  <div style={box}><SectionTitle sub="As alíquotas cheias futuras devem ser preenchidas com premissa validada. O ano define a parcela aplicável na transição.">{regime==="SIMPLES_NACIONAL"?"3":"4"}. IBS/CBS e créditos</SectionTitle>
   <div style={grid(4)}><F t="Base tributável" v={base} s={setBase}/><F t="CBS cheia %" v={cbs} s={setCbs}/><F t="IBS cheio %" v={ibs} s={setIbs}/><F t="Redução CBS %" v={redCbs} s={setRedCbs}/><F t="Redução IBS %" v={redIbs} s={setRedIbs}/><F t="Crédito CBS" v={credCbs} s={setCredCbs}/><F t="Crédito IBS" v={credIbs} s={setCredIbs}/><F t="Imposto Seletivo do período" v={seletivo} s={setSeletivo} help="Preencher somente quando a operação estiver sujeita."/>{ano==="2026"&&<label style={{display:"flex",gap:7,alignItems:"center",fontSize:9,fontWeight:800}}><input type="checkbox" checked={dispensa2026} onChange={e=>setDispensa2026(e.target.checked)}/>Considerar dispensa/compensação do teste de 2026</label>}{numero(ano)>=2027&&<label style={{display:"flex",gap:7,alignItems:"center",fontSize:9,fontWeight:800}}><input type="checkbox" checked={manterIpi} onChange={e=>setManterIpi(e.target.checked)}/>Manter IPI por exceção validada</label>}</div>
  </div>

  <div style={box}><SectionTitle sub="A comparação usa a carga total, não apenas IBS e CBS.">{regime==="SIMPLES_NACIONAL"?"4":"5"}. Comparativo completo</SectionTitle>
   <div style={grid(4)}><K t="Carga atual completa" v={moeda(calc.cargaAtual)} sub={fmtPct(calc.cargaEfetivaAtual)}/><K t={tituloNovo} v={totalNovoExibido==null?"Pendente":moeda(totalNovoExibido)} sub={totalNovoExibido==null?"Complete as premissas":fmtPct(calc.cargaEfetivaProjetada)}/><K t="Diferença" v={calc.diferenca==null?"Não comparável":moeda(calc.diferenca)} tone={tom}/><K t="Variação" v={calc.variacaoPct==null?"Não comparável":fmtPct(calc.variacaoPct)} tone={tom}/></div>
   <div style={{marginTop:12}}><BarChart items={[{label:"Carga atual",valor:calc.cargaAtual,cor:C.blue},{label:`Cenário ${ano}`,valor:totalNovoExibido||0,cor:C.green},{label:"IBS/CBS líquido",valor:calc.ibsCbs.total,cor:C.coral}]}/></div>
   {calc.avisos.map((a,i)=><div key={i} style={{marginTop:8,padding:"8px 10px",background:"#FFF7E8",border:"1px solid #F0D49C",borderRadius:8,color:C.amber,fontSize:9}}><b>Atenção:</b> {a}</div>)}
  </div>

  {regime==="SIMPLES_NACIONAL"&&<div style={box}><SectionTitle sub="O cenário por fora somente é conclusivo quando a composição do DAS estiver conciliada.">5. Simples: IBS/CBS dentro × por fora</SectionTitle>
   <div style={grid(4)}><K t="DAS + fora do DAS" v={moeda(simples.dentro)}/><K t="DAS residual" v={simples.dasResidualEstimado?.residual==null?"Pendente":moeda(simples.dasResidualEstimado.residual)}/><K t="IBS/CBS regular" v={moeda(calc.ibsCbs.total)}/><K t="Total por fora" v={simples.fora==null?"Pendente":moeda(simples.fora)}/></div>
   <div style={{marginTop:10,padding:"9px 10px",background:"#F7F9FC",borderRadius:9,fontSize:9}}><b>Menor carga matemática:</b> {simples.menorCargaMatematica==="NAO_CALCULAVEL"?"Pendente":simples.menorCargaMatematica}. Isso não equivale a recomendação automática; devem ser avaliados B2B/B2C, crédito transferido, preço, margem e caixa.</div>
  </div>}

  {regime==="SIMPLES_NACIONAL"&&<div style={box}><SectionTitle sub="Valores extraídos do PGDAS/DAS. A comparação por fora só é liberada como conclusiva quando a soma fecha com a guia.">6. Composição documental do DAS</SectionTitle>
   <Tabela minWidth={650}><thead><tr><TH left>Tributo</TH><TH>Valor no DAS</TH><TH left>Tratamento na estimativa por fora</TH></tr></thead><tbody>
    {[["irpj","IRPJ"],["adicionalIrpj","Adicional de IRPJ"],["csll","CSLL"],["cofins","Cofins"],["pis","PIS/Pasep"],["cpp","INSS/CPP"],["icms","ICMS"],["ipi","IPI"],["iss","ISS"],["outros","Outros"]].map(([id,nome])=><tr key={id}><TD left>{nome}</TD><TD>{moeda(componentesDas[id])}</TD><TD left>{["pis","cofins","icms","iss"].includes(id)?"Substituição conforme regras da transição":"Mantido no residual até validação específica"}</TD></tr>)}
    <tr style={{background:"#EAF0F8"}}><TD left bold>Total dos componentes</TD><TD bold>{moeda(somaComponentesDas)}</TD><TD left bold>{dasConciliado?"CONFERE COM O DAS":"REVISAR COMPOSIÇÃO"}</TD></tr>
   </tbody></Tabela>
   <div style={{marginTop:9,padding:"9px 10px",borderRadius:9,background:dasConciliado?"#E9F7EF":"#FFF7E8",border:`1px solid ${dasConciliado?"#BFE3CF":"#F0D49C"}`,fontSize:9,color:dasConciliado?C.green:C.amber}}><b>DAS informado:</b> {moeda(das)} · <b>Soma dos tributos:</b> {moeda(somaComponentesDas)} · <b>Status:</b> {dasConciliado?"conciliado":"não conciliado"}</div>
  </div>}

  {regime==="SIMPLES_NACIONAL"&&<div style={box}><SectionTitle sub="Comparação mensal calculada pelo mesmo motor da simulação. Alíquotas futuras continuam sendo premissas, não valores definitivos.">7. Simples por dentro × por fora — 2026 a 2033</SectionTitle>
   <Tabela minWidth={980}><thead><tr><TH left>Ano</TH><TH>DAS por dentro</TH><TH>DAS residual</TH><TH>CBS líquida</TH><TH>IBS líquido</TH><TH>Outros aplicáveis</TH><TH>Total por fora</TH><TH>Diferença</TH><TH left>Menor estimativa</TH></tr></thead><tbody>
    {transicao.map(x=><tr key={x.ano} style={{background:x.menor==="POR_FORA"?"#E9F7EF":"transparent"}}><TD left bold>{x.ano}</TD><TD>{moeda(x.dentro)}</TD><TD>{x.carga.simples?.dasResidualEstimado?.residual==null?"Pendente":moeda(x.carga.simples.dasResidualEstimado.residual)}</TD><TD>{moeda(x.carga.ibsCbs?.liquidoCBS)}</TD><TD>{moeda(x.carga.ibsCbs?.liquidoIBS)}</TD><TD>{moeda(numero(x.carga.impostoSeletivo)+numero(x.carga.outros)+numero(x.carga.tributosForaDas))}</TD><TD bold>{x.fora==null?"Pendente":moeda(x.fora)}</TD><TD tone={x.diferenca==null?undefined:x.diferenca>0?"red":"green"}>{x.diferenca==null?"Pendente":moeda(x.diferenca)}</TD><TD left bold>{x.menor.replaceAll("_"," ")}</TD></tr>)}
   </tbody></Tabela>
   <div style={{marginTop:9,padding:"9px 10px",background:"#FFF7E8",border:"1px solid #F0D49C",borderRadius:9,color:C.amber,fontSize:9,lineHeight:1.45}}><b>Importante:</b> “por dentro” e “por fora” são alternativas do Simples para IBS/CBS; não significam migração automática para Lucro Presumido ou Lucro Real. A decisão exige validação de créditos, clientes B2B/B2C, preço, margem, NCM/CNAE e regulamentação aplicável ao ano.</div>
  </div>}

  <div style={box}><SectionTitle sub="IRPJ, adicional, CSLL, folha e outros tributos permanecem visíveis.">{regime==="SIMPLES_NACIONAL"?"8":"6"}. Memória de cálculo</SectionTitle>
   <Linha nome="Faturamento" valor={moeda(calc.faturamento)} destaque/>
   {ano==="2026"&&<><Linha nome="CBS de teste — 0,9%" valor={moeda(calc.teste2026.liquidoCBS)} nota="Destaque de teste; não é carga definitiva."/><Linha nome="IBS de teste — 0,1%" valor={moeda(calc.teste2026.liquidoIBS)} nota="Destaque de teste; não é carga definitiva."/></>}
   <Linha nome="CBS líquida regular" valor={moeda(calc.ibsCbs.liquidoCBS)} nota={`${fmtPct(calc.ibsCbs.aliquotaCBSEfetiva)} × fator do ano ${fmtPct(calc.regra.cbsRegular*100)}`}/>
   <Linha nome="IBS líquido regular" valor={moeda(calc.ibsCbs.liquidoIBS)} nota={`${fmtPct(calc.ibsCbs.aliquotaIBSEfetiva)} × fator do ano ${fmtPct(calc.regra.ibsRegular*100)}`}/>
   <Linha nome="PIS/Cofins remanescentes" valor={moeda(calc.pisCofinsLegado)}/><Linha nome="ICMS/ISS remanescentes" valor={moeda(calc.icmsIssLegado)}/><Linha nome="IPI remanescente informado" valor={moeda(calc.ipiLegado)} nota={manterIpi?"Exceção marcada para validação.":"Redução conforme o ano selecionado."}/><Linha nome="Imposto Seletivo" valor={moeda(calc.impostoSeletivo)}/>
   <Linha nome="IRPJ" valor={moeda(calc.irpjCsll.irpj)}/><Linha nome="Adicional de IRPJ" valor={moeda(calc.irpjCsll.adicionalIrpj)}/><Linha nome="CSLL" valor={moeda(calc.irpjCsll.csll)}/><Linha nome="CPP/folha" valor={moeda(calc.cpp)}/><Linha nome="Outros e tributos fora do DAS" valor={moeda(calc.outros+calc.tributosForaDas)}/>
   {regime==="LUCRO_REAL"&&<Linha nome="Lucro fiscal tributável" valor={moeda(calc.irpjCsll.baseTributavel)} nota={calc.irpjCsll.houvePrejuizo?"Prejuízo fiscal: IRPJ e CSLL zerados.":"Base positiva após ajustes e compensação."} destaque/>}
   <Linha nome={tituloNovo} valor={totalNovoExibido==null?"Pendente":moeda(totalNovoExibido)} destaque/>
  </div>

  <div style={box}><SectionTitle sub="A projeção recalcula a carga total e mantém as relações informadas.">{regime==="SIMPLES_NACIONAL"?"9":"7"}. Sensibilidade de crescimento</SectionTitle><div style={{...grid(3),alignItems:"end"}}><F t="Crescimento do faturamento %" v={crescimento} s={setCrescimento}/><K t="Faturamento projetado" v={moeda(numero(fat)*escala)}/><K t="Carga total projetada" v={moeda(proj.totalProjetado)}/></div></div>

  <div style={box}><SectionTitle>{regime==="SIMPLES_NACIONAL"?"10":"8"}. Benefício ou tratamento diferenciado</SectionTitle><div style={grid(2)}><F t="Benefício/tratamento" v={beneficio} s={setBeneficio}/><F t="Status" v={statusBeneficio} s={setStatusBeneficio} type="select"><option value="POTENCIAL_VALIDAR">Potencial — validar</option><option value="APLICAVEL">Aplicável após validação</option><option value="NAO_APLICAVEL">Não aplicável</option></F></div><label style={{display:"grid",gap:4,fontSize:9,fontWeight:800,marginTop:8}}>Base legal / fonte oficial<textarea rows={3} value={baseLegal} onChange={e=>setBaseLegal(e.target.value)} style={{...inp,resize:"vertical"}}/></label></div>
 </div>;
}
