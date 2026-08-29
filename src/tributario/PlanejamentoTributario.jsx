// DESTINO REAL: /src/tributario/PlanejamentoTributario.jsx
import {useMemo,useState} from "react";
import {MESES,ROTULOS,baseVazia,num,moeda,pct,comparar,cenario} from "./planejamento-engine";

const C={navy:"#17233D",blue:"#31589C",coral:"#FF6B4A",muted:"#5B667A",white:"#fff",bg:"#F6F8FC",border:"#E3E7EF",green:"#0F6E56",red:"#993C1D",amber:"#854F0B"};
const BODY="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const DISPLAY="Georgia,'Iowan Old Style','Palatino Linotype',serif";
const inp={width:"100%",boxSizing:"border-box",border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 9px",background:C.white,color:C.navy,fontFamily:BODY,fontSize:11};
function Card({children,style={}}){return <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:15,padding:16,...style}}>{children}</div>}
function Btn({children,onClick,secondary=false,disabled=false}){return <button type="button" onClick={onClick} disabled={disabled} style={{border:secondary?`1px solid ${C.border}`:0,background:secondary?C.white:C.blue,color:secondary?C.navy:C.white,borderRadius:9,padding:"9px 12px",fontWeight:900,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1}}>{children}</button>}
const digits=v=>String(v||"").replace(/\D/g,"");
const fmtCnpj=v=>{const d=digits(v);return d.length===14?d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5"):v}
const fileData=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Falha ao ler arquivo"));r.readAsDataURL(file)});

function Mensal({label,mapa,onChange}){
 const total=MESES.reduce((a,m)=>a+num(mapa[m]),0);
 return <div style={{display:"grid",gridTemplateColumns:"150px repeat(12,minmax(70px,1fr)) 105px",gap:4,alignItems:"center",padding:"4px 0",borderBottom:"1px solid #F0F2F6"}}>
  <strong style={{fontSize:9.5}}>{label}</strong>
  {MESES.map(m=><input key={m} type="number" step="0.01" value={mapa[m]??0} onChange={e=>onChange(m,e.target.value)} style={{...inp,padding:"6px 5px"}}/>)}
  <strong style={{fontSize:9.5,textAlign:"right"}}>{moeda(total)}</strong>
 </div>
}
function Grade({children}){return <div style={{overflowX:"auto"}}><div style={{minWidth:1160}}><div style={{display:"grid",gridTemplateColumns:"150px repeat(12,minmax(70px,1fr)) 105px",gap:4}}><span/>{MESES.map(m=><b key={m} style={{fontSize:8.5,textAlign:"center",color:C.muted}}>{ROTULOS[m]}</b>)}<b style={{fontSize:8.5,textAlign:"right",color:C.muted}}>Total</b></div>{children}</div></div>}

export default function PlanejamentoTributario({token,onVoltar}){
 const [aba,setAba]=useState("identificacao"),[base,setBase]=useState(baseVazia),[cnpj,setCnpj]=useState(""),[empresa,setEmpresa]=useState(null),[cnaes,setCnaes]=useState([]),[principal,setPrincipal]=useState(""),[descricao,setDescricao]=useState(""),[arquivos,setArquivos]=useState([]),[erro,setErro]=useState(""),[ok,setOk]=useState(""),[extraindo,setExtraindo]=useState(false),[analisando,setAnalisando]=useState(false),[ia,setIa]=useState(null),[extracaoResumo,setExtracaoResumo]=useState(null),[crescimento,setCrescimento]=useState(0),[responsavel,setResponsavel]=useState(""),[origem,setOrigem]=useState("");
 const [projetoId]=useState(()=>{try{return crypto.randomUUID()}catch{return `plan_${Date.now()}`}});
 const calc=useMemo(()=>comparar(cenario(base,crescimento)),[base,crescimento]);

 async function api(action,{method="GET",body=null}={}){
  const r=await fetch(`/api/tributario?action=${encodeURIComponent(action)}`,{method,headers:{...(body?{"content-type":"application/json"}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json().catch(()=>null); if(!r.ok||!d?.sucesso) throw new Error(d?.error||"Falha na operação."); return d;
 }
 function setMes(path,m,v){setBase(a=>{const c=JSON.parse(JSON.stringify(a));let x=c;path.slice(0,-1).forEach(k=>x=x[k]);x[path.at(-1)][m]=num(v);return c})}
 function setParam(path,v){setBase(a=>{const c=JSON.parse(JSON.stringify(a));let x=c;path.slice(0,-1).forEach(k=>x=x[k]);x[path.at(-1)]=v;return c})}
 function mergeExtracao(ext){
  setExtracaoResumo(ext||null);

  if(ext?.identificacao?.cnpj) setCnpj(ext.identificacao.cnpj);

  if(ext?.identificacao?.razaoSocial){
    setEmpresa(a=>({
      ...(a||{}),
      razaoSocial:ext.identificacao.razaoSocial,
      razao_social:ext.identificacao.razaoSocial,
      municipio:ext.identificacao.municipio||a?.municipio||"",
      uf:ext.identificacao.uf||a?.uf||"",
      dataAbertura:ext.identificacao.dataAbertura||a?.dataAbertura||""
    }));
  }

  setBase(a=>{
    const c=JSON.parse(JSON.stringify(a));

    const merge=(d,s)=>{
      if(!s||typeof s!=="object") return;
      Object.entries(s).forEach(([k,v])=>{
        if(v&&typeof v==="object"&&!Array.isArray(v)&&d[k]&&typeof d[k]==="object"&&!Array.isArray(d[k])){
          merge(d[k],v);
        }else if(v!==null&&v!==undefined&&v!==""){
          d[k]=v;
        }
      });
    };

    merge(c,ext?.base||{});

    if(ext?.identificacao?.regimeAtual){
      const regime=String(ext.identificacao.regimeAtual).toUpperCase();
      c.parametros.regimeAtual=
        regime.includes("SIMPLES")?"SIMPLES_NACIONAL":
        regime.includes("PRESUM")?"LUCRO_PRESUMIDO":
        regime.includes("REAL")?"LUCRO_REAL":
        c.parametros.regimeAtual;
    }

    if(ext?.simplesNacional?.aliquotaEfetivaObservada!==null&&ext?.simplesNacional?.aliquotaEfetivaObservada!==undefined){
      c.parametros.simplesAliquotaEfetiva=num(ext.simplesNacional.aliquotaEfetivaObservada);
    }

    c.fontes=[...(c.fontes||[]),...(ext?.fontes||[])];
    c.divergencias=ext?.divergencias||[];
    c.dadosFaltantes=ext?.dadosFaltantes||[];

    return c;
  });
}

 async function consultar(){
  setErro(""); const d=digits(cnpj); if(d.length!==14){setErro("Informe CNPJ válido.");return}
  try{const r=await fetch(`/api/cnpj?cnpj=${d}`);const x=await r.json();if(!r.ok)throw new Error(x?.error||"Falha CNPJ");setEmpresa(x);
   const pr=x.cnaePrincipal||x.cnae?.principal||null,sec=x.cnaesSecundarios||x.cnae?.secundarios||[],todos=x.todosCnaes||x.cnae?.todos||[...(pr?[pr]:[]),...(Array.isArray(sec)?sec:[])];
   const ns=(Array.isArray(todos)?todos:[]).map(i=>({codigo:i.codigo||i.code||"",descricao:i.descricao||i.description||""})).filter(i=>i.codigo||i.descricao);setCnaes(ns);setPrincipal(pr?.codigo||pr?.code||ns[0]?.codigo||"");setOk("CNPJ e CNAEs carregados.");
  }catch(e){setErro(e.message)}
 }
 async function extrair(){
  if(!arquivos.length){setErro("Selecione documentos.");return} setExtraindo(true);setErro("");
  try{const ups=[];for(const f of arquivos){const u=await api("upload-file",{method:"POST",body:{filename:f.name,mimeType:f.type,fileData:await fileData(f)}});ups.push({fileId:u.fileId,filename:f.name,bytes:f.size})}
   const d=await api("planejamento-extrair",{method:"POST",body:{projetoId,cliente:{cnpj:digits(cnpj),razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||""},atividades:{cnaesSelecionados:cnaes,atividadePrincipalReal:principal,descricaoOperacao:descricao},arquivos:ups}});
   mergeExtracao(d.extracao);setIa(a=>({...a,extracao:d.extracao}));setAba("conferencia");setOk(`IA analisou ${arquivos.length} documento(s), preencheu os dados encontrados e registrou as fontes. Confira antes de calcular.`);
  }catch(e){setErro(e.message)}finally{setExtraindo(false)}
 }
 async function salvar(status="EM_ANALISE"){
  try{await api("salvar-projeto",{method:"POST",body:{id:projetoId,tipoProjeto:"planejamento",estrutura:"empresa",modalidade:arquivos.length?"hibrido":"manual",responsavelFinder:responsavel,origemCliente:origem,empresas:empresa?[{cnpj:digits(cnpj),razaoSocial:empresa.razaoSocial||empresa.razao_social||empresa.nome||""}]:[],atividades:{selecionadas:cnaes,principalReal:principal,descricaoReal:descricao},dadosManuais:{planejamentoV2:base,crescimento,calculos:calc},status}});setOk("Planejamento salvo.");}catch(e){setErro(e.message)}
 }
 async function analisar(){
  if(!calc.real?.completo){setErro("Preencha a base antes de gerar a análise.");return} setAnalisando(true);setErro("");
  try{const d=await api("planejamento-analisar",{method:"POST",body:{projetoId,cliente:{cnpj:digits(cnpj),razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||""},atividades:{cnaesSelecionados:cnaes,atividadePrincipalReal:principal,descricaoOperacao:descricao},base,calculos:calc,crescimento}});
   setIa(a=>({...a,analise:d.analise}));await salvar("DIAGNOSTICO_GERADO");await api("salvar-diagnostico",{method:"POST",body:{projetoId,tipoProjeto:"planejamento",diagnostico:d.analise,documentos:arquivos.map(f=>({filename:f.name,bytes:f.size})),modelo:d.modelo,usage:d.usage||null}});setAba("relatorio");setOk("Análise IA gerada e salva.");
  }catch(e){setErro(e.message)}finally{setAnalisando(false)}
 }

 const tabs=[["identificacao","1. Identificação"],["documentos","2. Documentos"],["base","3. Faturamento"],["folha","4. Folha / Fator R"],["custos","5. Custos / Despesas"],["conferencia","6. Conferência IA"],["comparativo","7. Comparativo"],["cenarios","8. Cenários"],["relatorio","9. Relatório"]];
 return <div style={{fontFamily:BODY,color:C.navy,background:C.bg}}>
  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:10}}><button onClick={onVoltar} style={{border:0,background:"transparent",fontWeight:800,color:C.muted,cursor:"pointer"}}>← Voltar</button><div style={{display:"flex",gap:7}}><Btn secondary onClick={()=>salvar()}>Salvar</Btn><Btn disabled={analisando} onClick={analisar}>{analisando?"Analisando...":"Gerar análise IA"}</Btn></div></div>
  <div style={{background:"linear-gradient(135deg,#0E1A33,#17233D)",color:"#fff",borderRadius:20,padding:22,marginBottom:12}}><div style={{fontSize:9,fontWeight:900,color:"#9EBBFF"}}>PLANEJAMENTO TRIBUTÁRIO · MOTOR FS V2</div><h2 style={{fontFamily:DISPLAY,fontSize:27,margin:"6px 0"}}>Regime e eficiência tributária</h2><p style={{margin:0,fontSize:10.5,color:"#D8DEEA"}}>Faturamento, custos, despesas, folha/Fator R, créditos, Simples, Presumido, Real, DRE e cenários. Sem IBS/CBS nesta versão.</p></div>
  <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:10}}>{tabs.map(([id,l])=><button key={id} onClick={()=>setAba(id)} style={{whiteSpace:"nowrap",border:`1px solid ${aba===id?C.blue:C.border}`,background:aba===id?"#EEF3FF":"#fff",color:aba===id?C.blue:C.navy,borderRadius:999,padding:"7px 10px",fontSize:9.5,fontWeight:900,cursor:"pointer"}}>{l}</button>)}</div>
  {erro&&<div style={{background:"#FAECE7",color:C.red,padding:10,borderRadius:9,marginBottom:10,fontSize:10}}>{erro}</div>}{ok&&<div style={{background:"#E1F5EE",color:C.green,padding:10,borderRadius:9,marginBottom:10,fontSize:10}}>{ok}</div>}

  {aba==="identificacao"&&<div style={{display:"grid",gap:10}}>
   <Card><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}><label><b style={{fontSize:9}}>RESPONSÁVEL</b><input value={responsavel} onChange={e=>setResponsavel(e.target.value)} style={{...inp,marginTop:4}}/></label><label><b style={{fontSize:9}}>ORIGEM</b><input value={origem} onChange={e=>setOrigem(e.target.value)} style={{...inp,marginTop:4}}/></label><label><b style={{fontSize:9}}>REGIME ATUAL</b><select value={base.parametros.regimeAtual} onChange={e=>setParam(["parametros","regimeAtual"],e.target.value)} style={{...inp,marginTop:4}}><option value="">Selecione</option><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option></select></label></div></Card>
   <Card><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:7,alignItems:"end"}}><label><b style={{fontSize:9}}>CNPJ</b><input value={cnpj} onChange={e=>setCnpj(e.target.value)} style={{...inp,marginTop:4}}/></label><Btn onClick={consultar}>Consultar CNPJ</Btn></div>{empresa&&<div style={{marginTop:10,padding:10,background:"#F7F9FC",borderRadius:10}}><strong>{empresa.razaoSocial||empresa.razao_social||empresa.nome}</strong><div style={{fontSize:9,color:C.muted}}>{fmtCnpj(cnpj)}</div><div style={{display:"grid",gap:4,marginTop:8}}>{cnaes.map((x,i)=><label key={i} style={{fontSize:9.5}}><input type="radio" checked={principal===x.codigo} onChange={()=>setPrincipal(x.codigo)}/> <b>{x.codigo}</b> · {x.descricao}</label>)}</div><textarea rows={4} value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Descreva o que a empresa realmente faz..." style={{...inp,marginTop:9,fontFamily:BODY}}/></div>}</Card>
  </div>}

  {aba==="documentos"&&<Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>IA identifica e organiza os documentos</h3><p style={{fontSize:10,color:C.muted}}>PGDAS-D, DRE, balancete, razão, ECD/ECF, SPED, folha, pró-labore, XML e apurações. A IA extrai a base e registra fonte/confiança.</p><input type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.xml,.txt" onChange={e=>setArquivos(Array.from(e.target.files||[]))}/><div style={{display:"grid",gap:4,marginTop:8}}>{arquivos.map((f,i)=><div key={i} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:7,fontSize:9.5}}>{f.name} · {(f.size/1024/1024).toFixed(2)} MB</div>)}</div><div style={{marginTop:10}}><Btn disabled={extraindo} onClick={extrair}>{extraindo?"Lendo documentos...":"Extrair base com IA"}</Btn></div></Card>}

  {aba==="base"&&<div style={{display:"grid",gap:10}}><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Faturamento mensal</h3><Grade>{[["Indústria","industria"],["Comércio","comercio"],["Serviços","servicos"]].map(([l,k])=><Mensal key={k} label={l} mapa={base.faturamento[k]} onChange={(m,v)=>setMes(["faturamento",k],m,v)}/>)}</Grade></Card><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Tributos operacionais</h3><Grade>{[["PIS","pis"],["COFINS","cofins"],["ICMS","icms"],["IPI","ipi"],["ISS","iss"]].map(([l,k])=><Mensal key={k} label={l} mapa={base.tributos[k]} onChange={(m,v)=>setMes(["tributos",k],m,v)}/>)}</Grade></Card><Card><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}><label><b style={{fontSize:9}}>SIMPLES · ALÍQUOTA EFETIVA %</b><input type="number" value={base.parametros.simplesAliquotaEfetiva} onChange={e=>setParam(["parametros","simplesAliquotaEfetiva"],num(e.target.value))} style={{...inp,marginTop:4}}/></label><label><b style={{fontSize:9}}>PRESUNÇÃO IRPJ %</b><input type="number" value={base.parametros.presumido.presuncaoIrpj} onChange={e=>setParam(["parametros","presumido","presuncaoIrpj"],num(e.target.value))} style={{...inp,marginTop:4}}/></label><label><b style={{fontSize:9}}>PRESUNÇÃO CSLL %</b><input type="number" value={base.parametros.presumido.presuncaoCsll} onChange={e=>setParam(["parametros","presumido","presuncaoCsll"],num(e.target.value))} style={{...inp,marginTop:4}}/></label></div></Card></div>}

  {aba==="folha"&&<div style={{display:"grid",gap:10}}><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Folha e Fator R</h3><Grade>{[["Folha / 13º","folha13"],["Pró-labore","proLabore"],["INSS + FGTS","inssFgts"],["Outros","outros"],["Encargos patronais","encargosPatronais"]].map(([l,k])=><Mensal key={k} label={l} mapa={base.folha[k]} onChange={(m,v)=>setMes(["folha",k],m,v)}/>)}</Grade></Card><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}><Card><small>RBT12</small><h3>{moeda(calc.fatorR.rbt12)}</h3></Card><Card><small>Massa salarial 12m</small><h3>{moeda(calc.fatorR.massa)}</h3></Card><Card><small>Fator R</small><h3 style={{color:calc.fatorR.atinge28?C.green:C.red}}>{pct(calc.fatorR.percentual)}</h3><div style={{fontSize:9,color:C.muted}}>Referência de 28% somente quando aplicável.</div></Card></div></div>}

  {aba==="custos"&&<div style={{display:"grid",gap:10}}>{[
   ["Indústria · CPV","industria",[["Estoque inicial","estoqueInicial"],["Insumos","insumos"],["Mão de obra direta","maoObraDireta"],["GGF","ggf"],["Estoque final","estoqueFinal"]]],
   ["Comércio · CMV","comercio",[["Estoque inicial","estoqueInicial"],["Compras","compras"],["Estoque final","estoqueFinal"]]],
   ["Serviços · CSP","servicos",[["Serviços em andamento inicial","servicosInicial"],["Mão de obra direta","maoObraDireta"],["Gastos diretos","gastosDiretos"],["Gastos indiretos","gastosIndiretos"],["Serviços finais","servicosFinal"]]]
  ].map(([titulo,g,linhas])=><Card key={g}><h3 style={{fontFamily:DISPLAY,marginTop:0}}>{titulo}</h3><Grade>{linhas.map(([l,k])=><Mensal key={k} label={l} mapa={base.custos[g][k]} onChange={(m,v)=>setMes(["custos",g,k],m,v)}/>)}</Grade></Card>)}<Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Despesas</h3><Grade>{[["Operacionais","operacionais"],["Comerciais","comerciais"],["Administrativas","administrativas"],["Tributárias","tributarias"],["Diretoria","diretoria"],["Logística","logistica"],["Ocupação","ocupacao"],["Outras","outras"]].map(([l,k])=><Mensal key={k} label={l} mapa={base.despesas[k]} onChange={(m,v)=>setMes(["despesas",k],m,v)}/>)}</Grade></Card><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Créditos</h3><Grade>{[["PIS","pis"],["COFINS","cofins"],["ICMS","icms"],["IPI","ipi"]].map(([l,k])=><Mensal key={k} label={`Crédito ${l}`} mapa={base.creditos[k]} onChange={(m,v)=>setMes(["creditos",k],m,v)}/>)}</Grade></Card></div>}

  {aba==="conferencia"&&<div style={{display:"grid",gap:9}}>
   {extracaoResumo&&<>
    <Card>
     <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Resumo identificado automaticamente</h3>
     <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
      <div><small>EMPRESA</small><b style={{display:"block"}}>{extracaoResumo.identificacao?.razaoSocial||empresa?.razaoSocial||"-"}</b></div>
      <div><small>CNPJ</small><b style={{display:"block"}}>{extracaoResumo.identificacao?.cnpj||cnpj||"-"}</b></div>
      <div><small>REGIME</small><b style={{display:"block"}}>{extracaoResumo.identificacao?.regimeAtual||base.parametros.regimeAtual||"-"}</b></div>
      <div><small>APURAÇÃO</small><b style={{display:"block"}}>{extracaoResumo.identificacao?.regimeApuracao||"-"}</b></div>
     </div>

     <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:10}}>
      <div><small>COMPETÊNCIA</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.competencia||"-"}</b></div>
      <div><small>RPA</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.rpa!=null?moeda(extracaoResumo.simplesNacional.rpa):"-"}</b></div>
      <div><small>RBT12</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.rbt12!=null?moeda(extracaoResumo.simplesNacional.rbt12):"-"}</b></div>
      <div><small>DAS</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.dasTotal!=null?moeda(extracaoResumo.simplesNacional.dasTotal):"-"}</b></div>
      <div><small>ALÍQUOTA OBSERVADA</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.aliquotaEfetivaObservada!=null?pct(extracaoResumo.simplesNacional.aliquotaEfetivaObservada):"-"}</b></div>
     </div>

     <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:10}}>
      <div><small>ANEXO</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.anexo||"-"}</b></div>
      <div><small>ATIVIDADE TRIBUTADA</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.atividadeTributada||"-"}</b></div>
      <div><small>FATOR R</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.fatorR||"-"}</b></div>
      <div><small>ISS</small><b style={{display:"block"}}>{extracaoResumo.simplesNacional?.issMunicipio||"-"}</b></div>
     </div>
    </Card>

    {Array.isArray(extracaoResumo.simplesNacional?.receitasHistoricas)&&extracaoResumo.simplesNacional.receitasHistoricas.length>0&&
     <Card>
      <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Histórico identificado no PGDAS</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6}}>
       {extracaoResumo.simplesNacional.receitasHistoricas.filter(x=>x.mercado==="INTERNO").map((x,i)=>
        <div key={i} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:8}}>
         <small>{x.competencia}</small>
         <b style={{display:"block",marginTop:3}}>{x.receita!=null?moeda(x.receita):"-"}</b>
        </div>
       )}
      </div>
     </Card>
    }
   </>}

   <Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Conferência por fonte</h3>
    {!base.fontes.length?
     <p style={{fontSize:10,color:C.muted}}>Nenhum documento extraído. Você pode preencher manualmente.</p>:
     <div style={{display:"grid",gap:5}}>
      {base.fontes.map((f,i)=>
       <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr .8fr 1fr 80px",gap:7,border:`1px solid ${C.border}`,borderRadius:8,padding:8,fontSize:9.5}}>
        <b>{f.campo}</b>
        <span>{String(f.valor??"")}</span>
        <span>{f.documento||f.fonte}</span>
        <b style={{color:f.confianca==="ALTA"?C.green:f.confianca==="MEDIA"?C.amber:C.red}}>{f.confianca}</b>
       </div>
      )}
     </div>
    }
   </Card>

   {base.divergencias?.length>0&&
    <Card style={{background:"#FFF9EE"}}>
     <b style={{color:C.amber}}>Divergências</b>
     <ul>{base.divergencias.map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul>
    </Card>
   }

   {base.dadosFaltantes?.length>0&&
    <Card style={{background:"#FFF7F7"}}>
     <b style={{color:C.red}}>Dados faltantes para concluir o planejamento</b>
     <ul>{base.dadosFaltantes.map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul>
    </Card>
   }

   <Card style={{background:"#EEF3FF"}}>
    <b style={{color:C.blue}}>Validação profissional</b>
    <p style={{fontSize:10,lineHeight:1.5,marginBottom:0}}>
     Documento e consulta cadastral preenchem a base automaticamente. A IA não deve inventar CNAE, folha, custos, despesas ou créditos. O comparativo deve ser interpretado somente com a base efetivamente confirmada.
    </p>
   </Card>
  </div>}

  {aba==="comparativo"&&<div style={{display:"grid",gap:10}}><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>{[["Simples",calc.simples],["Presumido",calc.presumido],["Real",calc.real]].map(([l,x])=><Card key={l}><small>{l.toUpperCase()}</small><h2 style={{margin:"5px 0"}}>{moeda(x.total)}</h2><div style={{fontSize:10,color:C.muted}}>Carga: {pct(x.carga)}</div>{!x.completo&&<div style={{fontSize:9,color:C.red,marginTop:5}}>Base insuficiente</div>}</Card>)}</div><Card><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}><div><small>REGIME ATUAL</small><b style={{display:"block"}}>{base.parametros.regimeAtual||"-"}</b></div><div><small>MENOR CARGA MATEMÁTICA</small><b style={{display:"block"}}>{calc.melhor?.regime||"-"}</b></div><div><small>ECONOMIA POTENCIAL</small><b style={{display:"block",color:C.green}}>{moeda(calc.economia)}</b></div><div><small>REDUÇÃO</small><b style={{display:"block",color:C.green}}>{pct(calc.economiaPct)}</b></div></div><div style={{marginTop:10,padding:9,background:"#FFF9EE",fontSize:9.5,color:C.amber,borderRadius:8}}>Menor carga matemática não é recomendação automática. A IA avaliará riscos e validações.</div></Card><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>DRE comparativa</h3><div style={{display:"grid",gridTemplateColumns:"1.4fr repeat(3,1fr)",gap:5,fontSize:9.5}}><b>Indicador</b><b>Simples</b><b>Presumido</b><b>Real</b>{[["Receita bruta","receitaBruta"],["Tributos","tributos"],["Receita líquida","receitaLiquida"],["CPV","cpv"],["CMV","cmv"],["CSP","csp"],["Despesas","despesas"],["Lucro líquido estimado","lucroLiquido"]].flatMap(([l,k])=>[<span key={k+"l"}>{l}</span>,<span key={k+"s"}>{moeda(calc.dre.simples[k])}</span>,<span key={k+"p"}>{moeda(calc.dre.presumido[k])}</span>,<span key={k+"r"}>{moeda(calc.dre.real[k])}</span>])}</div></Card></div>}

  {aba==="cenarios"&&<div style={{display:"grid",gap:9}}><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Cenário de crescimento</h3><div style={{display:"flex",gap:6}}>{[0,10,20,30].map(x=><Btn key={x} secondary={crescimento!==x} onClick={()=>setCrescimento(x)}>{x===0?"Atual":`+${x}%`}</Btn>)}<input type="number" value={crescimento} onChange={e=>setCrescimento(num(e.target.value))} style={{...inp,width:100}}/></div></Card><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}><Card><b>Simples</b><h3>{moeda(calc.simples.total)}</h3></Card><Card><b>Presumido</b><h3>{moeda(calc.presumido.total)}</h3></Card><Card><b>Real</b><h3>{moeda(calc.real.total)}</h3></Card></div></div>}

  {aba==="relatorio"&&<div style={{display:"grid",gap:9}}><Card style={{background:"linear-gradient(135deg,#0E1A33,#17233D)",color:"#fff"}}><small style={{color:"#9EBBFF"}}>RESUMO EXECUTIVO</small><h2 style={{fontFamily:DISPLAY}}>{empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||"Planejamento Tributário"}</h2><p style={{fontSize:10.5,lineHeight:1.6,color:"#D8DEEA"}}>{ia?.analise?.resumoExecutivo||"Gere a análise IA após conferir a base."}</p></Card>{ia?.analise&&<><Card><h3 style={{fontFamily:DISPLAY,marginTop:0}}>Recomendação</h3><p style={{fontSize:10.5,lineHeight:1.6}}>{ia.analise.recomendacao}</p></Card><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}><Card><b>Riscos</b><ul>{(ia.analise.riscos||[]).map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul></Card><Card><b>Oportunidades</b><ul>{(ia.analise.oportunidades||[]).map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul></Card><Card><b>Validações</b><ul>{(ia.analise.validacoesNecessarias||[]).map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul></Card></div></>}</div>}
 </div>
}
