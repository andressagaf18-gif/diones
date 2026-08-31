// DESTINO REAL: /src/tributario/PlanejamentoTributario.jsx
import {useEffect,useMemo,useState} from "react";
import {jsPDF} from "jspdf";
import {MESES,ROTULOS,baseVazia,num,moeda,pct,comparar,cenario} from "./planejamento-engine";

const C={navy:"#17233D",blue:"#31589C",coral:"#FF6B4A",muted:"#5B667A",white:"#fff",bg:"#F6F8FC",border:"#E3E7EF",green:"#0F6E56",red:"#993C1D",amber:"#854F0B"};
const BODY="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const DISPLAY="Georgia,'Iowan Old Style','Palatino Linotype',serif";
const inp={width:"100%",boxSizing:"border-box",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 11px",background:"#FCFDFE",color:C.navy,fontFamily:BODY,fontSize:11,outline:"none"};
function Card({children,style={}}){return <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:18,padding:18,boxShadow:"0 8px 26px rgba(23,35,61,.045)",...style}}>{children}</div>}
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
 const [aba,setAba]=useState("identificacao"),[base,setBase]=useState(baseVazia),[cnpj,setCnpj]=useState(""),[empresa,setEmpresa]=useState(null),[cnaes,setCnaes]=useState([]),[principal,setPrincipal]=useState(""),[descricao,setDescricao]=useState(""),[arquivos,setArquivos]=useState([]),[erro,setErro]=useState(""),[ok,setOk]=useState(""),[extraindo,setExtraindo]=useState(false),[analisando,setAnalisando]=useState(false),[ia,setIa]=useState(null),[extracaoResumo,setExtracaoResumo]=useState(null),[conferenciaIa,setConferenciaIa]=useState(null),[conferenciaDesatualizada,setConferenciaDesatualizada]=useState(false),[gerandoConferencia,setGerandoConferencia]=useState(false),[crescimento,setCrescimento]=useState(0),[responsavel,setResponsavel]=useState(""),[origem,setOrigem]=useState("");
 const [gerandoPdf,setGerandoPdf]=useState(false);
 const [documentosBanco,setDocumentosBanco]=useState([]);
 const [documentosSelecionados,setDocumentosSelecionados]=useState({});
 const [salvandoDocumentos,setSalvandoDocumentos]=useState(false);
 const [projetoId]=useState(()=>{try{return crypto.randomUUID()}catch{return `plan_${Date.now()}`}});
 const calc=useMemo(()=>comparar(cenario(base,crescimento)),[base,crescimento]);

 async function api(action,{method="GET",body=null}={}){
  const r=await fetch(`/api/tributario?action=${encodeURIComponent(action)}`,{method,headers:{...(body?{"content-type":"application/json"}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json().catch(()=>null); if(!r.ok||!d?.sucesso) throw new Error(d?.error||"Falha na operação."); return d;
 }

 const EXTENSOES_SUPORTADAS_IA=new Set([
  "art","bat","brf","c","cls","css","csv","diff","doc","docx","dot","eml","epub","es",
  "h","hs","htm","html","hwp","hwpx","ics","ifb","java","js","json","keynote","ksh","ltx",
  "mail","markdown","md","mht","mhtml","mjs","msg","nws","odp","ods","odt","otp","ots",
  "pages","patch","pdf","pl","pm","pot","potm","potx","ppa","pps","ppsm","ppsx","ppt",
  "pptm","pptx","pwz","py","rst","rtf","scala","sh","shtml","srt","sty","svg","svgz",
  "tex","text","txt","tsv","vcf","vtt","wiz","xla","xlb","xlc","xlm","xls","xlsx","xlt",
  "xlw","xml","yaml","yml"
 ]);

 function extensaoArquivo(nome){
  const partes=String(nome||"").toLowerCase().split(".");
  return partes.length>1?partes.pop():"";
 }

 function arquivoSuportadoIA(arq){
  return EXTENSOES_SUPORTADAS_IA.has(extensaoArquivo(arq?.name));
 }

 function adicionarArquivos(novos){
  const lista=Array.from(novos||[]);
  if(!lista.length)return;

  const invalidos=lista.filter(a=>!arquivoSuportadoIA(a));
  const validos=lista.filter(arquivoSuportadoIA);

  if(invalidos.length){
   setErro(`Arquivo(s) não suportado(s): ${invalidos.map(a=>a.name).join(", ")}. Converta para PDF, XLSX, CSV, XML, TXT, DOCX ou outro formato suportado.`);
  }else{
   setErro("");
  }

  setArquivos(atuais=>{
   const mapa=new Map();
   [...atuais,...validos].forEach(f=>{
    const chave=`${f.name}__${f.size}__${f.lastModified}`;
    if(!mapa.has(chave))mapa.set(chave,f);
   });
   return Array.from(mapa.values());
  });
 }

 function removerArquivoLocal(indice){
  setArquivos(atuais=>atuais.filter((_,i)=>i!==indice));
 }

 async function carregarDocumentosBanco(cnpjForcado=""){
  const d=digits(cnpjForcado||cnpj);
  if(d.length!==14){
   setDocumentosBanco([]);
   return [];
  }

  try{
   const r=await api(`listar-documentos&cnpj=${encodeURIComponent(d)}`);
   const docs=Array.isArray(r.documentos)?r.documentos:[];
   setDocumentosBanco(docs);
   setDocumentosSelecionados(atual=>{
    const proximo={...atual};
    docs.forEach(doc=>{
     if(proximo[doc.id]===undefined)proximo[doc.id]=true;
    });
    return proximo;
   });
   return docs;
  }catch(e){
   setErro(e?.message||"Não foi possível carregar os documentos do cliente.");
   return [];
  }
 }

 async function removerDocumentoBanco(id){
  if(!window.confirm("Remover este documento do arquivo ativo do cliente?"))return;
  try{
   await api("remover-documento",{method:"POST",body:{id}});
   setDocumentosSelecionados(atual=>({...atual,[id]:false}));
   await carregarDocumentosBanco();
   setOk("Documento removido do arquivo ativo do cliente.");
  }catch(e){
   setErro(e?.message||"Não foi possível remover o documento.");
  }
 }

 useEffect(()=>{
  if(digits(cnpj).length===14){
   carregarDocumentosBanco(cnpj);
  }
 },[cnpj]);

 function setMes(path,m,v){setConferenciaDesatualizada(true);setBase(a=>{const c=JSON.parse(JSON.stringify(a));let x=c;path.slice(0,-1).forEach(k=>x=x[k]);x[path.at(-1)][m]=num(v);return c})}
 function setParam(path,v){setConferenciaDesatualizada(true);setBase(a=>{const c=JSON.parse(JSON.stringify(a));let x=c;path.slice(0,-1).forEach(k=>x=x[k]);x[path.at(-1)]=v;return c})}
 function mergeExtracao(ext){
  setExtracaoResumo(ext||null);
  setConferenciaIa(null);
  setConferenciaDesatualizada(false);

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
   const ns=(Array.isArray(todos)?todos:[]).map(i=>({codigo:i.codigo||i.code||"",descricao:i.descricao||i.description||""})).filter(i=>i.codigo||i.descricao);setCnaes(ns);setPrincipal(pr?.codigo||pr?.code||ns[0]?.codigo||"");await carregarDocumentosBanco(d);setOk("CNPJ, CNAEs e arquivo documental do cliente carregados.");
  }catch(e){setErro(e.message)}
 }
 async function extrair(){
  const cnpjLimpo=digits(cnpj);

  if(cnpjLimpo.length!==14){
   setErro("Consulte um CNPJ válido antes de armazenar e analisar documentos.");
   return;
  }

  const existentesSelecionados=documentosBanco
   .filter(d=>d.ativo!==false&&documentosSelecionados[d.id]!==false)
   .map(d=>d.id);

  if(!arquivos.length&&!existentesSelecionados.length){
   setErro("Adicione ou selecione pelo menos um documento do arquivo do cliente.");
   return;
  }

  setExtraindo(true);
  setSalvandoDocumentos(true);
  setErro("");
  setOk("");

  try{
   const novosPreparados=[];

   // Cada novo arquivo é salvo permanentemente no banco do cliente
   // e recebe também um fileId temporário para esta análise.
   for(const f of arquivos){
    if(!arquivoSuportadoIA(f)){
     throw new Error(`${f.name}: formato não suportado pela IA.`);
    }

    const u=await api("upload-file",{
     method:"POST",
     body:{
      projetoId,
      cnpj:cnpjLimpo,
      tipoProjeto:"planejamento",
      categoria:"planejamento",
      filename:f.name,
      mimeType:f.type,
      fileData:await fileData(f),
      persistir:true
     }
    });

    novosPreparados.push({
     documentId:u.documentoId,
     fileId:u.fileId,
     filename:f.name,
     bytes:f.size
    });
   }

   // Documentos antigos ficam no banco. Para uma nova análise,
   // o backend os envia novamente à OpenAI e cria fileIds temporários.
   let antigosPreparados=[];

   if(existentesSelecionados.length){
    const p=await api("preparar-documentos-ia",{
     method:"POST",
     body:{documentoIds:existentesSelecionados}
    });
    antigosPreparados=Array.isArray(p.arquivos)?p.arquivos:[];
   }

   const mapa=new Map();

   [...antigosPreparados,...novosPreparados].forEach(a=>{
    const chave=a.documentId||`${a.filename}_${a.bytes}`;
    mapa.set(chave,a);
   });

   const ups=Array.from(mapa.values());

   if(!ups.length){
    throw new Error("Nenhum documento pôde ser preparado para análise.");
   }

   const d=await api("planejamento-extrair",{
    method:"POST",
    body:{
     projetoId,
     cliente:{
      cnpj:cnpjLimpo,
      razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||""
     },
     atividades:{
      cnaesSelecionados:cnaes,
      atividadePrincipalReal:principal,
      descricaoOperacao:descricao
     },
     arquivos:ups
    }
   });

   mergeExtracao(d.extracao);
   setIa(a=>({...a,extracao:d.extracao}));
   setArquivos([]);

   const docs=await carregarDocumentosBanco(cnpjLimpo);
   setAba("conferencia");
   setOk(`IA analisou ${ups.length} documento(s). O arquivo do cliente agora possui ${docs.length} documento(s) ativo(s). Você pode voltar à aba Documentos, anexar mais e reprocessar a análise.`);
  }catch(e){
   setErro(e?.message||"Não foi possível armazenar/analisar os documentos.");
  }finally{
   setSalvandoDocumentos(false);
   setExtraindo(false);
  }
 }
 async function salvar(status="EM_ANALISE"){
  try{await api("salvar-projeto",{method:"POST",body:{id:projetoId,tipoProjeto:"planejamento",estrutura:"empresa",modalidade:(arquivos.length||documentosBanco.length)?"hibrido":"manual",responsavelFinder:responsavel,origemCliente:origem,empresas:empresa?[{cnpj:digits(cnpj),razaoSocial:empresa.razaoSocial||empresa.razao_social||empresa.nome||""}]:[],atividades:{selecionadas:cnaes,principalReal:principal,descricaoReal:descricao},dadosManuais:{planejamentoV2:base,crescimento,calculos:calc},status}});setOk("Planejamento salvo.");}catch(e){setErro(e.message)}
 }
 async function gerarConferenciaIA(){
  setGerandoConferencia(true);
  setErro("");
  setOk("");

  try{
    const d=await api("planejamento-conferir",{
      method:"POST",
      body:{
        projetoId,
        cliente:{
          cnpj:digits(cnpj),
          razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||""
        },
        atividades:{
          cnaesSelecionados:cnaes,
          atividadePrincipalReal:principal,
          descricaoOperacao:descricao
        },
        base,
        extracaoOriginal:extracaoResumo,
        responsavel,
        origem
      }
    });

    setConferenciaIa(d.conferencia);
    setConferenciaDesatualizada(false);
    setOk("Nova Conferência IA gerada com base nos dados atuais.");
  }catch(e){
    setErro(e?.message||"Não foi possível gerar a nova Conferência IA.");
  }finally{
    setGerandoConferencia(false);
  }
 }

 async function analisar(){
  if(!calc.real?.completo){setErro("Preencha a base antes de gerar a análise.");return} setAnalisando(true);setErro("");
  try{const d=await api("planejamento-analisar",{method:"POST",body:{projetoId,cliente:{cnpj:digits(cnpj),razaoSocial:empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||""},atividades:{cnaesSelecionados:cnaes,atividadePrincipalReal:principal,descricaoOperacao:descricao},base,calculos:calc,crescimento}});
   setIa(a=>({...a,analise:d.analise}));await salvar("DIAGNOSTICO_GERADO");await api("salvar-diagnostico",{method:"POST",body:{projetoId,tipoProjeto:"planejamento",diagnostico:d.analise,documentos:documentosBanco
    .filter(d=>d.ativo!==false&&documentosSelecionados[d.id]!==false)
    .map(d=>({id:d.id,filename:d.filename,bytes:d.bytes,categoria:d.categoria,criadoEm:d.criadoEm})),modelo:d.modelo,usage:d.usage||null}});setAba("relatorio");setOk("Análise IA gerada e salva.");
  }catch(e){setErro(e.message)}finally{setAnalisando(false)}
 }


 const regimesComparativo=useMemo(()=>[
  {id:"SIMPLES_NACIONAL",label:"Simples Nacional",dados:calc.simples,color:"#31589C"},
  {id:"LUCRO_PRESUMIDO",label:"Lucro Presumido",dados:calc.presumido,color:"#FF6B4A"},
  {id:"LUCRO_REAL",label:"Lucro Real",dados:calc.real,color:"#17233D"}
 ],[calc]);

 const regimesValidos=useMemo(
  ()=>regimesComparativo.filter(r=>r.dados?.completo),
  [regimesComparativo]
 );

 const comparativoMax=useMemo(
  ()=>Math.max(...regimesValidos.map(r=>num(r.dados.total)),1),
  [regimesValidos]
 );

 const prontidao=useMemo(()=>{
  const receitaTotal=MESES.reduce((a,m)=>
   a+num(base.faturamento?.industria?.[m])
    +num(base.faturamento?.comercio?.[m])
    +num(base.faturamento?.servicos?.[m]),0);

  const checks=[
   {id:"cnpj",label:"Empresa/CNPJ",ok:digits(cnpj).length===14},
   {id:"operacao",label:"Operação real",ok:Boolean(descricao)},
   {id:"faturamento",label:"Faturamento",ok:receitaTotal>0},
   {id:"documentos",label:"Documentos",ok:Boolean(extracaoResumo)||documentosBanco.length>0},
   {id:"conferencia",label:"Conferência IA",ok:Boolean(conferenciaIa)&&!conferenciaDesatualizada},
   {id:"simples",label:"Simples calculável",ok:Boolean(calc.simples?.completo)},
   {id:"presumido",label:"Presumido calculável",ok:Boolean(calc.presumido?.completo)},
   {id:"real",label:"Real calculável",ok:Boolean(calc.real?.completo)},
   {id:"analise",label:"Análise técnica IA",ok:Boolean(ia?.analise)}
  ];

  const completos=checks.filter(x=>x.ok).length;
  const percentual=Math.round(completos/checks.length*100);
  const conclusivo=percentual>=89&&regimesValidos.length>=2&&Boolean(ia?.analise);

  return{
   checks,
   percentual,
   conclusivo,
   status:conclusivo?"CONCLUSIVO":percentual>=67?"PRELIMINAR AVANÇADO":"PRELIMINAR",
   faltantes:checks.filter(x=>!x.ok)
  };
 },[cnpj,descricao,base,extracaoResumo,documentosBanco,conferenciaIa,conferenciaDesatualizada,calc,ia,regimesValidos]);

 const recomendacaoMotor=useMemo(()=>{
  if(!calc.melhor){
   return{
    titulo:"Base insuficiente para recomendar regime",
    texto:"Complete faturamento, folha, custos, despesas e parâmetros tributários antes de comparar os regimes.",
    regime:null
   };
  }

  if(regimesValidos.length<2){
   return{
    titulo:`${calc.melhor.regime} é o único cenário calculável`,
    texto:"Não trate esse resultado como recomendação. É necessário ter pelo menos dois regimes calculáveis para uma comparação útil.",
    regime:calc.melhor.regime
   };
  }

  const nomes={
   SIMPLES_NACIONAL:"Simples Nacional",
   LUCRO_PRESUMIDO:"Lucro Presumido",
   LUCRO_REAL:"Lucro Real"
  };

  return{
   titulo:`${nomes[calc.melhor.regime]||calc.melhor.regime} aparece como menor carga matemática`,
   texto:ia?.analise?.recomendacao||"A hipótese precisa ser validada com elegibilidade, créditos, margem, folha, natureza das receitas, operação real e documentação.",
   regime:calc.melhor.regime
  };
 },[calc,regimesValidos,ia]);

 const cenariosPadrao=useMemo(()=>[0,10,20,30,50].map(p=>{
  const c=comparar(cenario(base,p));
  return{crescimento:p,simples:c.simples,presumido:c.presumido,real:c.real,melhor:c.melhor};
 }),[base]);

 const plano306090=useMemo(()=>{
  const plano=conferenciaIa?.planoAcao||{};
  const validacoes=ia?.analise?.validacoesNecessarias||[];
  const oportunidades=ia?.analise?.oportunidades||[];

  return{
   d30:[...(plano.imediato||[]),...validacoes.slice(0,2)].slice(0,4),
   d60:[...(plano.antesMudancaRegime||[]),...validacoes.slice(2,4)].slice(0,4),
   d90:[...(plano.acompanhamento||[]),...oportunidades.slice(0,2)].slice(0,4)
  };
 },[conferenciaIa,ia]);

 async function gerarRelatorioPdf(){
  setGerandoPdf(true);setErro("");

  try{
   const doc=new jsPDF({unit:"mm",format:"a4",compress:true});
   const W=210,M=14,CONTENT=W-M*2;
   const P={
    navy:[23,35,61],navy2:[14,26,51],blue:[49,88,156],coral:[255,107,74],
    green:[15,110,86],red:[153,60,29],amber:[133,79,11],muted:[91,102,122],
    text:[55,64,80],line:[226,231,239],soft:[247,249,252],white:[255,255,255]
   };
   let y=14,secao="Resumo executivo";

   const nome=empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||"Planejamento Tributário";
   const safe=v=>String(v??"").replace(/[–—]/g,"-").replace(/→/g,"->").replace(/•/g,"-");
   const money=v=>moeda(num(v));
   const percent=v=>pct(num(v));

   const footer=()=>{
    doc.setDrawColor(...P.line);doc.line(M,286,W-M,286);
    doc.setFont("helvetica","normal");doc.setFontSize(6.8);doc.setTextColor(...P.muted);
    doc.text("Finder Intelligence | Planejamento Tributario",M,291);
    doc.text(secao,W/2,291,{align:"center"});
   };
   const numero=()=>{
    const p=doc.internal.getCurrentPageInfo().pageNumber;
    doc.setFontSize(6.8);doc.setTextColor(...P.muted);doc.text(`Pagina ${p}`,W-M,291,{align:"right"});
   };
   const addPage=(s=secao)=>{footer();numero();doc.addPage();y=16;secao=s};
   const need=h=>{if(y+h>280)addPage(secao)};
   const card=(x,yy,w,h,fill=P.white,draw=P.line)=>{
    doc.setFillColor(...fill);doc.setDrawColor(...draw);doc.roundedRect(x,yy,w,h,3,3,"FD");
   };
   const title=(t,sub="")=>{
    need(sub?17:11);
    doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(...P.navy);doc.text(safe(t),M,y);y+=6;
    if(sub){
     doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.setTextColor(...P.muted);
     const ls=doc.splitTextToSize(safe(sub),CONTENT);doc.text(ls,M,y);y+=ls.length*3.4+3;
    }else y+=2;
   };
   const para=(t,size=8.2,color=P.text)=>{
    if(!t)return;
    doc.setFont("helvetica","normal");doc.setFontSize(size);doc.setTextColor(...color);
    const ls=doc.splitTextToSize(safe(t),CONTENT);need(ls.length*3.7+3);doc.text(ls,M,y);y+=ls.length*3.7+3;
   };
   const kpi=(x,yy,w,label,value,color=P.navy,sub="")=>{
    card(x,yy,w,22,P.soft,P.line);
    doc.setFont("helvetica","bold");doc.setFontSize(6.1);doc.setTextColor(...P.muted);doc.text(safe(label).toUpperCase(),x+4,yy+5.5);
    doc.setFontSize(11.2);doc.setTextColor(...color);doc.text(safe(value),x+4,yy+13);
    if(sub){doc.setFont("helvetica","normal");doc.setFontSize(6);doc.setTextColor(...P.muted);doc.text(safe(sub),x+4,yy+18.5);}
   };
   const bars=(titulo,items,subtitle="")=>{
    if(!items.length)return;
    title(titulo,subtitle);
    const h=Math.max(31,14+items.length*10);
    card(M,y,CONTENT,h,P.white,P.line);
    const max=Math.max(...items.map(i=>num(i.value)),1);
    let yy=y+7;
    items.forEach(i=>{
     doc.setFont("helvetica","bold");doc.setFontSize(7.1);doc.setTextColor(...P.navy);doc.text(safe(i.label),M+4,yy+3.5);
     doc.setFillColor(238,241,245);doc.roundedRect(M+48,yy,96,6,2,2,"F");
     doc.setFillColor(...i.color);doc.roundedRect(M+48,yy,Math.max(num(i.value)>0?1:0,96*num(i.value)/max),6,2,2,"F");
     doc.setFontSize(7.1);doc.text(safe(i.format?i.format(i.value):money(i.value)),W-M-4,yy+3.5,{align:"right"});
     yy+=10;
    });
    y+=h+6;
   };
   const bullets=(titulo,arr,color=P.coral)=>{
    if(!arr?.length)return;
    title(titulo);
    arr.forEach(x=>{
     const ls=doc.splitTextToSize(safe(x),CONTENT-10);need(ls.length*3.6+4);
     doc.setFillColor(...color);doc.circle(M+2,y-1.1,1.15,"F");
     doc.setFont("helvetica","normal");doc.setFontSize(7.8);doc.setTextColor(...P.text);doc.text(ls,M+6,y);
     y+=ls.length*3.6+2.5;
    });
   };
   const table=(headers,rows,widths)=>{
    const rh=7;need((rows.length+1)*rh+5);
    doc.setFillColor(...P.navy);doc.rect(M,y,CONTENT,rh,"F");
    let x=M;
    headers.forEach((h,i)=>{doc.setFont("helvetica","bold");doc.setFontSize(6.3);doc.setTextColor(...P.white);doc.text(safe(h),x+2,y+4.6);x+=widths[i]});
    y+=rh;
    rows.forEach((row,ri)=>{
     if(ri%2===0){doc.setFillColor(...P.soft);doc.rect(M,y,CONTENT,rh,"F")}
     x=M;
     row.forEach((v,i)=>{doc.setFont("helvetica",i===0?"bold":"normal");doc.setFontSize(6.5);doc.setTextColor(...P.text);doc.text(safe(v),x+2,y+4.6);x+=widths[i]});
     y+=rh;
    });
    y+=5;
   };

   const rs=[
    {label:"Simples",x:calc.simples,color:P.blue},
    {label:"Presumido",x:calc.presumido,color:P.coral},
    {label:"Real",x:calc.real,color:P.navy}
   ];

   // 1 - capa
   doc.setFillColor(...P.navy2);doc.rect(0,0,W,70,"F");
   doc.setFillColor(...P.coral);doc.rect(0,0,5,70,"F");
   doc.setFont("helvetica","bold");doc.setFontSize(7.5);doc.setTextColor(160,190,255);
   doc.text("FINDER INTELLIGENCE | PLANEJAMENTO TRIBUTARIO",M,14);
   doc.setFontSize(21);doc.setTextColor(...P.white);doc.text("Regime e eficiencia tributaria",M,28);
   doc.setFontSize(15);doc.text(doc.splitTextToSize(safe(nome),150),M,40);
   doc.setFont("helvetica","normal");doc.setFontSize(7.7);doc.setTextColor(216,222,234);
   doc.text(`CNPJ ${fmtCnpj(cnpj)||"-"} | Regime atual: ${safe(base.parametros?.regimeAtual||"-")}`,M,57);
   doc.text(`Status: ${safe(prontidao.status)} | Prontidao ${prontidao.percentual}% | ${regimesValidos.length} regime(s) calculavel(is)`,M,64);
   y=80;

   title("Resposta executiva","Cenarios incompletos aparecem como pendentes e nao entram na escolha do menor regime.");
   rs.forEach((r,i)=>kpi(M+i*60,y,56,r.label,r.x.completo?money(r.x.total):"Pendente",r.color,r.x.completo?`Carga ${percent(r.x.carga)}`:"Base insuficiente"));
   y+=29;

   bars("Grafico 1 - Carga anual por regime",
    rs.filter(r=>r.x.completo).map(r=>({label:r.label,value:r.x.total,color:r.color})),
    "Comparacao anual somente entre regimes calculaveis."
   );

   title("Recomendacao do motor");
   card(M,y,CONTENT,32,P.soft,P.line);
   doc.setFont("helvetica","bold");doc.setFontSize(10.2);doc.setTextColor(...P.navy);
   doc.text(doc.splitTextToSize(safe(recomendacaoMotor.titulo),CONTENT-10),M+5,y+7);
   doc.setFont("helvetica","normal");doc.setFontSize(7.4);doc.setTextColor(...P.text);
   doc.text(doc.splitTextToSize(safe(recomendacaoMotor.texto),CONTENT-10),M+5,y+17);
   y+=38;

   // 2 - comparativo
   addPage("Comparativo detalhado");
   title("Comparativo tributario","Total anual, carga efetiva e status de completude.");
   table(["Regime","Tributos anuais","Carga","Status"],rs.map(r=>[
    r.label,
    r.x.completo?money(r.x.total):"Pendente",
    r.x.completo?percent(r.x.carga):"-",
    r.x.completo?"Calculavel":"Base insuficiente"
   ]),[48,52,35,47]);

   bars("Grafico 2 - Carga efetiva por regime",
    rs.filter(r=>r.x.completo).map(r=>({label:r.label,value:r.x.carga,color:r.color,format:v=>`${num(v).toFixed(2)}%`})),
    "Tributos em relacao a receita bruta."
   );

   title("DRE comparativa");
   table(["Indicador","Simples","Presumido","Real"],[
    ["Receita bruta",money(calc.dre.simples.receitaBruta),money(calc.dre.presumido.receitaBruta),money(calc.dre.real.receitaBruta)],
    ["Tributos",money(calc.dre.simples.tributos),money(calc.dre.presumido.tributos),money(calc.dre.real.tributos)],
    ["Receita liquida",money(calc.dre.simples.receitaLiquida),money(calc.dre.presumido.receitaLiquida),money(calc.dre.real.receitaLiquida)],
    ["CPV",money(calc.dre.simples.cpv),money(calc.dre.presumido.cpv),money(calc.dre.real.cpv)],
    ["CMV",money(calc.dre.simples.cmv),money(calc.dre.presumido.cmv),money(calc.dre.real.cmv)],
    ["CSP",money(calc.dre.simples.csp),money(calc.dre.presumido.csp),money(calc.dre.real.csp)],
    ["Despesas",money(calc.dre.simples.despesas),money(calc.dre.presumido.despesas),money(calc.dre.real.despesas)],
    ["Lucro liquido",money(calc.dre.simples.lucroLiquido),money(calc.dre.presumido.lucroLiquido),money(calc.dre.real.lucroLiquido)]
   ],[51,44,44,43]);

   bars("Grafico 3 - Lucro liquido estimado",[
    {label:"Simples",value:Math.max(0,num(calc.dre.simples.lucroLiquido)),color:P.blue},
    {label:"Presumido",value:Math.max(0,num(calc.dre.presumido.lucroLiquido)),color:P.coral},
    {label:"Real",value:Math.max(0,num(calc.dre.real.lucroLiquido)),color:P.navy}
   ]);

   // 3 - crescimento
   addPage("Cenarios de crescimento");
   title("Sensibilidade a crescimento","O objetivo e verificar se a vantagem matematica se mantem com crescimento da receita.");
   [
    ["Simples","simples",P.blue],
    ["Presumido","presumido",P.coral],
    ["Real","real",P.navy]
   ].forEach(([label,key,color])=>{
    bars(`Grafico - ${label}`,cenariosPadrao.map(c=>({
     label:c.crescimento===0?"Atual":`+${c.crescimento}%`,
     value:c[key]?.completo?c[key].total:0,
     color
    })));
   });

   // 4 - qualidade
   addPage("Qualidade da base");
   title("Qualidade e rastreabilidade","Antes da decisao, o cliente precisa saber o que esta comprovado e o que ainda depende de validacao.");
   kpi(M,y,42,"Prontidao",`${prontidao.percentual}%`,prontidao.conclusivo?P.green:P.amber,prontidao.status);
   kpi(M+45,y,42,"Regimes calculaveis",String(regimesValidos.length),P.blue);
   kpi(M+90,y,42,"Documentos",String(documentosBanco.length),P.navy);
   kpi(M+135,y,47,"Conferencia IA",conferenciaIa&&!conferenciaDesatualizada?"Atualizada":"Pendente",conferenciaIa&&!conferenciaDesatualizada?P.green:P.amber);
   y+=29;
   table(["Item","Status"],prontidao.checks.map(x=>[x.label,x.ok?"OK":"Pendente"]),[130,52]);

   if(conferenciaIa?.qualidadeBase){
    const q=conferenciaIa.qualidadeBase;
    bars("Grafico 4 - Origem da base",[
     {label:"Documental",value:num(q.documentalPct),color:P.blue,format:v=>`${num(v).toFixed(0)}%`},
     {label:"Cadastral",value:num(q.cadastralPct),color:[92,112,138],format:v=>`${num(v).toFixed(0)}%`},
     {label:"Manual",value:num(q.manualPct),color:P.coral,format:v=>`${num(v).toFixed(0)}%`},
     {label:"Calculado",value:num(q.calculadoPct),color:P.green,format:v=>`${num(v).toFixed(0)}%`},
     {label:"Pendente",value:num(q.pendentePct),color:P.amber,format:v=>`${num(v).toFixed(0)}%`}
    ]);
   }

   bullets("Pendencias reais",conferenciaIa?.dadosFaltantes||ia?.analise?.validacoesNecessarias||[],P.amber);
   bullets("Premissas utilizadas",conferenciaIa?.premissas||[],P.blue);

   // 5 - riscos / oportunidades
   addPage("Riscos e oportunidades");
   bullets("Riscos",ia?.analise?.riscos||conferenciaIa?.riscosTributarios||[],P.red);
   bullets("Oportunidades",ia?.analise?.oportunidades||conferenciaIa?.oportunidades||[],P.green);

   if(conferenciaIa?.beneficiosFiscais?.length){
    title("Beneficios fiscais / enquadramentos");
    conferenciaIa.beneficiosFiscais.slice(0,10).forEach((b,i)=>{
     need(20);card(M,y,CONTENT,18,P.soft,P.line);
     doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(...P.navy);
     doc.text(`${i+1}. ${safe(b.nome)} | ${safe(b.situacao)}`,M+4,y+5.5);
     doc.setFont("helvetica","normal");doc.setFontSize(6.7);doc.setTextColor(...P.text);
     const info=`Tributo: ${safe(b.tributo||"-")} | Fundamento: ${safe(b.fundamentoLegal||"-")} ${safe(b.artigo||"")} | Vigencia: ${safe(b.vigencia||"-")}`;
     doc.text(doc.splitTextToSize(info,CONTENT-8),M+4,y+11);y+=22;
    });
   }

   // 6 - plano
   addPage("Plano executivo");
   title("Plano 30 / 60 / 90 dias","O planejamento termina em acoes, nao apenas em uma comparacao de aliquotas.");
   [
    ["0-30 dias",plano306090.d30,P.blue],
    ["31-60 dias",plano306090.d60,P.amber],
    ["61-90 dias",plano306090.d90,P.green]
   ].forEach(([fase,itens,color])=>{
    if(!itens.length)return;
    doc.setFont("helvetica","bold");doc.setFontSize(9.3);doc.setTextColor(...color);doc.text(fase,M,y);y+=6;
    itens.forEach(item=>{
     const ls=doc.splitTextToSize(safe(item),CONTENT-9);need(ls.length*3.7+3);
     doc.setFillColor(...color);doc.circle(M+2,y-1,1,"F");
     doc.setFont("helvetica","normal");doc.setFontSize(7.8);doc.setTextColor(...P.text);doc.text(ls,M+6,y);y+=ls.length*3.7+2;
    });
    y+=3;
   });

   title("Conclusao tecnica");
   para(ia?.analise?.recomendacao||"A recomendacao tecnica final ainda nao foi gerada.");
   para("Menor carga matematica nao representa recomendacao automatica. A decisao deve considerar elegibilidade, natureza das receitas, folha, margem, custos, despesas, creditos e risco operacional.",8);

   bullets("Validacoes antes da decisao",ia?.analise?.validacoesNecessarias||[],P.amber);

   // 7 - ressalvas
   addPage("Fundamentacao e ressalvas");
   title("Rastreabilidade e ressalvas");
   para("O relatorio distingue dados documentais, cadastrais, manuais, calculados e projetados. Valores nao comprovados nao devem ser tratados como zero.",8);
   para("Cenarios incompletos aparecem como pendentes e nao participam da selecao do menor regime.",8);
   para("Beneficios fiscais e conclusoes juridicas somente devem ser utilizados quando houver fundamento vigente e fonte verificavel.",8);
   para("Este relatorio refere-se ao Planejamento Tributario. IBS/CBS e Reforma Tributaria devem ser analisados no modulo especifico.",8);

   footer();numero();

   const total=doc.getNumberOfPages();
   for(let p=1;p<=total;p++){
    doc.setPage(p);doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(...P.muted);
    doc.text(`${p}/${total}`,W-M,291,{align:"right"});
   }

   const arquivo=`Finder_Planejamento_Tributario_${safe(nome).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").slice(0,55)}.pdf`;
   doc.save(arquivo);
   setOk("Relatório executivo PDF gerado com gráficos.");
  }catch(e){
   console.error("[planejamento][pdf]",e);
   setErro(e?.message||"Não foi possível gerar o PDF.");
  }finally{
   setGerandoPdf(false);
  }
 }

 const tabs=[["identificacao","1. Identificação"],["documentos","2. Documentos"],["base","3. Faturamento"],["folha","4. Folha / Fator R"],["custos","5. Custos / Despesas"],["conferencia","6. Conferência IA"],["comparativo","7. Comparativo"],["cenarios","8. Cenários"],["relatorio","9. Relatório"]];
 return <div className="finder-planejamento-v30" style={{fontFamily:BODY,color:C.navy,background:"#F5F7FB",minHeight:"100vh",padding:18}}>
  <style>{`
   .finder-planejamento-v30 *{box-sizing:border-box}
   .finder-planejamento-v30 input:focus,.finder-planejamento-v30 select:focus,.finder-planejamento-v30 textarea:focus{border-color:#7D92B8!important;box-shadow:0 0 0 3px rgba(49,88,156,.10)}
   .pt-shell{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px;align-items:start}
   .pt-side{position:sticky;top:14px}
   .pt-main{min-width:0}
   @media(max-width:1050px){.pt-shell{grid-template-columns:1fr}.pt-side{position:static}.pt-nav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}}
   @media(max-width:720px){.finder-planejamento-v30{padding:10px!important}.pt-nav{grid-template-columns:repeat(2,minmax(0,1fr))}
   }
  `}</style>

  <div style={{maxWidth:1500,margin:"0 auto"}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
    <button onClick={onVoltar} style={{border:"1px solid #E1E6EE",background:"#fff",borderRadius:10,padding:"8px 11px",fontWeight:800,color:C.muted,cursor:"pointer"}}>← Voltar para Inteligência Tributária</button>
    <div style={{display:"flex",gap:7}}><Btn secondary onClick={()=>salvar()}>Salvar</Btn><Btn disabled={analisando} onClick={analisar}>{analisando?"Analisando...":"Gerar análise IA"}</Btn></div>
   </div>

   <div style={{display:"grid",gridTemplateColumns:"1.5fr .75fr",gap:14,background:"linear-gradient(135deg,#0E1A33,#17233D 58%,#29436F)",color:"#fff",borderRadius:22,padding:22,marginBottom:12,boxShadow:"0 18px 45px rgba(23,35,61,.16)"}}>
    <div>
     <div style={{fontSize:8.5,fontWeight:900,color:"#9EBBFF",letterSpacing:.55}}>FINDER INTELLIGENCE · PLANEJAMENTO TRIBUTÁRIO</div>
     <h1 style={{fontFamily:DISPLAY,fontSize:29,margin:"7px 0 4px"}}>Regime e eficiência tributária</h1>
     <p style={{margin:0,fontSize:10,color:"#D8DEEA",lineHeight:1.65,maxWidth:760}}>Documentos + IA + motor determinístico para comparar Simples Nacional, Lucro Presumido e Lucro Real. O sistema separa cálculo, qualidade da base, risco e recomendação técnica.</p>
    </div>

    <div style={{background:"rgba(255,255,255,.075)",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,padding:15}}>
     <div style={{fontSize:8,fontWeight:900,color:"#BFC8D8"}}>ANÁLISE ATUAL</div>
     <div style={{fontSize:15,fontWeight:900,marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{empresa?.razaoSocial||empresa?.razao_social||empresa?.nome||"Empresa ainda não identificada"}</div>
     <div style={{fontSize:8.5,color:"#C9D3E3",marginTop:3}}>{fmtCnpj(cnpj)||"CNPJ pendente"} · {base.parametros.regimeAtual||"Regime pendente"}</div>
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:12}}>
      <div style={{background:"rgba(255,255,255,.07)",borderRadius:10,padding:9}}><div style={{fontSize:7,color:"#BFC8D8",fontWeight:900}}>PRONTIDÃO</div><div style={{fontSize:18,fontWeight:900,marginTop:2}}>{prontidao.percentual}%</div></div>
      <div style={{background:"rgba(255,255,255,.07)",borderRadius:10,padding:9}}><div style={{fontSize:7,color:"#BFC8D8",fontWeight:900}}>REGIMES VÁLIDOS</div><div style={{fontSize:18,fontWeight:900,marginTop:2}}>{regimesValidos.length}/3</div></div>
      <div style={{background:"rgba(255,255,255,.07)",borderRadius:10,padding:9}}><div style={{fontSize:7,color:"#BFC8D8",fontWeight:900}}>DOCUMENTOS</div><div style={{fontSize:18,fontWeight:900,marginTop:2}}>{documentosBanco.length}</div></div>
      <div style={{background:"rgba(255,255,255,.07)",borderRadius:10,padding:9}}><div style={{fontSize:7,color:"#BFC8D8",fontWeight:900}}>STATUS</div><div style={{fontSize:10.5,fontWeight:900,marginTop:5,color:prontidao.conclusivo?"#8BE0B5":"#FFD38A"}}>{prontidao.status}</div></div>
     </div>
    </div>
   </div>

   {erro&&<div style={{background:"#FFF8F6",border:"1px solid #F0C4BC",color:C.red,padding:10,borderRadius:10,marginBottom:10,fontSize:10}}><b>Atenção:</b> {erro}</div>}
   {ok&&<div style={{background:"#F5FCF8",border:"1px solid #B9DFC8",color:C.green,padding:10,borderRadius:10,marginBottom:10,fontSize:10}}>{ok}</div>}

   <div className="pt-shell">
    <aside className="pt-side">
     <div style={{background:"#fff",border:"1px solid #E5EAF1",borderRadius:18,padding:10,boxShadow:"0 8px 25px rgba(23,35,61,.045)"}}>
      <div style={{padding:"7px 8px 9px"}}><div style={{fontSize:8,fontWeight:900,color:C.muted}}>FLUXO DO PLANEJAMENTO</div><div style={{fontSize:9.5,fontWeight:800,marginTop:3}}>Da base à decisão</div></div>
      <div className="pt-nav" style={{display:"grid",gap:4}}>
       {tabs.map(([id,l],idx)=>{
        const ativo=aba===id;
        const concluido=
         (id==="identificacao"&&digits(cnpj).length===14)||
         (id==="documentos"&&(documentosBanco.length>0||Boolean(extracaoResumo)))||
         (id==="base"&&regimesValidos.length>0)||
         (id==="conferencia"&&Boolean(conferenciaIa)&&!conferenciaDesatualizada)||
         (id==="comparativo"&&regimesValidos.length>=2)||
         (id==="cenarios"&&regimesValidos.length>=2)||
         (id==="relatorio"&&Boolean(ia?.analise));
        return <button key={id} onClick={()=>setAba(id)} style={{border:`1px solid ${ativo?C.navy:"#EDF0F4"}`,background:ativo?C.navy:"#fff",color:ativo?"#fff":C.navy,borderRadius:10,padding:"9px",display:"grid",gridTemplateColumns:"24px 1fr auto",gap:7,alignItems:"center",textAlign:"left",cursor:"pointer"}}>
         <span style={{width:23,height:23,borderRadius:7,display:"grid",placeItems:"center",background:ativo?"rgba(255,255,255,.12)":concluido?"#EAF7F0":"#F2F4F7",color:ativo?"#fff":concluido?C.green:C.muted,fontSize:8,fontWeight:900}}>{idx+1}</span>
         <span style={{fontSize:8.5,fontWeight:850}}>{l.replace(/^\\d+\\.\\s*/,"")}</span>
         <span style={{fontSize:8,color:ativo?"#DDE5F2":concluido?C.green:"#B0B7C3"}}>{concluido?"✓":"•"}</span>
        </button>
       })}
      </div>

      <div style={{borderTop:"1px solid #EEF0F4",marginTop:10,padding:"11px 7px 4px"}}>
       <div style={{fontSize:7.5,fontWeight:900,color:C.muted}}>PRONTIDÃO DO LAUDO</div>
       <div style={{height:7,background:"#EEF1F5",borderRadius:999,overflow:"hidden",marginTop:7}}><div style={{height:"100%",width:`${prontidao.percentual}%`,background:prontidao.conclusivo?C.green:prontidao.percentual>=67?C.amber:C.coral}}/></div>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:8,marginTop:5,color:C.muted}}><span>{prontidao.status}</span><b>{prontidao.percentual}%</b></div>
      </div>
     </div>
    </aside>

    <main className="pt-main">

  {aba==="identificacao"&&<div style={{display:"grid",gap:10}}>
   <Card><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}><label><b style={{fontSize:9}}>RESPONSÁVEL</b><input value={responsavel} onChange={e=>{setResponsavel(e.target.value);setConferenciaDesatualizada(true)}} style={{...inp,marginTop:4}}/></label><label><b style={{fontSize:9}}>ORIGEM</b><input value={origem} onChange={e=>{setOrigem(e.target.value);setConferenciaDesatualizada(true)}} style={{...inp,marginTop:4}}/></label><label><b style={{fontSize:9}}>REGIME ATUAL</b><select value={base.parametros.regimeAtual} onChange={e=>setParam(["parametros","regimeAtual"],e.target.value)} style={{...inp,marginTop:4}}><option value="">Selecione</option><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option></select></label></div></Card>
   <Card><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:7,alignItems:"end"}}><label><b style={{fontSize:9}}>CNPJ</b><input value={cnpj} onChange={e=>{setCnpj(e.target.value);setConferenciaDesatualizada(true)}} style={{...inp,marginTop:4}}/></label><Btn onClick={consultar}>Consultar CNPJ</Btn></div>{empresa&&<div style={{marginTop:10,padding:10,background:"#F7F9FC",borderRadius:10}}><strong>{empresa.razaoSocial||empresa.razao_social||empresa.nome}</strong><div style={{fontSize:9,color:C.muted}}>{fmtCnpj(cnpj)}</div><div style={{display:"grid",gap:4,marginTop:8}}>{cnaes.map((x,i)=><label key={i} style={{fontSize:9.5}}><input type="radio" checked={principal===x.codigo} onChange={()=>{setPrincipal(x.codigo);setConferenciaDesatualizada(true)}}/> <b>{x.codigo}</b> · {x.descricao}</label>)}</div><textarea rows={4} value={descricao} onChange={e=>{setDescricao(e.target.value);setConferenciaDesatualizada(true)}} placeholder="Descreva o que a empresa realmente faz..." style={{...inp,marginTop:9,fontFamily:BODY}}/></div>}</Card>
  </div>}

  {aba==="documentos"&&<div style={{display:"grid",gap:10}}>
   <Card>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start",flexWrap:"wrap"}}>
     <div>
      <h3 style={{fontFamily:DISPLAY,margin:"0 0 4px"}}>Arquivo documental do cliente</h3>
      <p style={{fontSize:10,color:C.muted,margin:0}}>Os documentos ficam vinculados ao CNPJ. Você pode anexar novos arquivos depois e refazer a análise com uma base mais completa.</p>
     </div>
     <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      <span style={{background:"#EEF3FF",color:C.blue,borderRadius:999,padding:"5px 8px",fontSize:8.5,fontWeight:900}}>{documentosBanco.length} salvo(s)</span>
      <span style={{background:"#FFF3EF",color:C.coral,borderRadius:999,padding:"5px 8px",fontSize:8.5,fontWeight:900}}>{arquivos.length} novo(s)</span>
     </div>
    </div>

    <div style={{marginTop:10,padding:"9px 10px",background:"#FFF8E7",border:"1px solid #F3D99B",borderRadius:9,fontSize:9,color:C.amber}}>
     A análise usa somente os documentos marcados abaixo. Arquivos como <b>.REC</b> não são suportados pela IA e devem ser convertidos antes.
    </div>

    <label style={{display:"inline-flex",marginTop:10,padding:"9px 12px",border:`1px dashed ${C.border}`,borderRadius:9,background:"#F8FAFD",fontSize:10,fontWeight:900,cursor:"pointer"}}>
     + Adicionar documentos
     <input
      type="file"
      multiple
      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.xml,.txt,.json,.md,.rtf,.odt,.ods,.ppt,.pptx,.html,.yaml,.yml,.eml,.msg"
      style={{display:"none"}}
      onChange={e=>{
       adicionarArquivos(e.target.files);
       e.target.value="";
      }}
     />
    </label>

    {!!arquivos.length&&<div style={{marginTop:12}}>
     <strong style={{fontSize:10}}>Novos documentos — ainda não salvos</strong>
     <div style={{display:"grid",gap:5,marginTop:6}}>
      {arquivos.map((f,i)=><div key={`${f.name}_${f.size}_${f.lastModified}`} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",border:`1px solid ${C.border}`,borderRadius:8,padding:8,fontSize:9.5,background:"#FFFDFB"}}>
       <div><b>{f.name}</b><div style={{color:C.muted,fontSize:8.5}}>{(f.size/1024/1024).toFixed(2)} MB</div></div>
       <button type="button" disabled={extraindo} onClick={()=>removerArquivoLocal(i)} style={{border:"1px solid #F0C7BD",background:"#FFF6F3",color:C.red,borderRadius:7,padding:"5px 8px",fontSize:8.5,fontWeight:800,cursor:"pointer"}}>Remover</button>
      </div>)}
     </div>
    </div>}
   </Card>

   <Card>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
     <div>
      <h3 style={{fontFamily:DISPLAY,margin:"0 0 3px"}}>Documentos já salvos</h3>
      <div style={{fontSize:9,color:C.muted}}>Marque os arquivos que devem participar da próxima análise.</div>
     </div>
     <Btn secondary onClick={()=>carregarDocumentosBanco()} disabled={extraindo}>Atualizar lista</Btn>
    </div>

    <div style={{display:"grid",gap:6,marginTop:10}}>
     {documentosBanco.map(doc=><div key={doc.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:9,alignItems:"center",border:`1px solid ${C.border}`,borderRadius:9,padding:9}}>
      <input type="checkbox" checked={documentosSelecionados[doc.id]!==false} onChange={e=>setDocumentosSelecionados(a=>({...a,[doc.id]:e.target.checked}))}/>
      <div style={{minWidth:0}}>
       <div style={{fontSize:9.5,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{doc.filename}</div>
       <div style={{fontSize:8.3,color:C.muted}}>{(num(doc.bytes)/1024/1024).toFixed(2)} MB · {doc.tipoProjeto||"tributário"} · {doc.criadoPorNome||"Usuário"} · {doc.criadoEm?new Date(doc.criadoEm).toLocaleString("pt-BR"):""}</div>
      </div>
      <button type="button" disabled={extraindo} onClick={()=>removerDocumentoBanco(doc.id)} style={{border:"1px solid #F0C7BD",background:"#FFF6F3",color:C.red,borderRadius:7,padding:"5px 8px",fontSize:8.5,fontWeight:800,cursor:"pointer"}}>Remover</button>
     </div>)}

     {!documentosBanco.length&&<div style={{padding:18,textAlign:"center",fontSize:9.5,color:C.muted}}>Nenhum documento salvo para este CNPJ ainda.</div>}
    </div>

    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:12}}>
     <Btn disabled={extraindo||salvandoDocumentos} onClick={extrair}>
      {salvandoDocumentos?"Salvando documentos...":extraindo?"Lendo documentos...":"Salvar novos + analisar documentos selecionados"}
     </Btn>
     <span style={{fontSize:8.7,color:C.muted}}>Você pode repetir esse processo sempre que chegar um novo PGDAS, DRE, balancete, folha, SPED ou outro documento.</span>
    </div>
   </Card>
  </div>}

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

   <Card style={{
    borderColor:conferenciaDesatualizada?"#F0C27B":C.border,
    background:conferenciaDesatualizada?"#FFF9EE":"#F8FAFD"
   }}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
     <div>
      <b style={{color:conferenciaDesatualizada?C.amber:C.navy}}>
       {conferenciaDesatualizada?"Conferência IA desatualizada":"Conferência IA atual"}
      </b>
      <p style={{fontSize:10,color:C.muted,margin:"4px 0 0",lineHeight:1.5}}>
       {conferenciaDesatualizada
        ?"Você alterou dados depois da última leitura. Gere uma nova conferência antes de usar o comparativo como base da análise."
        :"Se alterar faturamento, regime, folha, custos, despesas, CNAEs ou atividade, gere uma nova conferência."}
      </p>
     </div>

     <Btn onClick={gerarConferenciaIA} disabled={gerandoConferencia}>
      {gerandoConferencia?"Gerando nova conferência...":"Gerar nova Conferência IA"}
     </Btn>
    </div>
   </Card>

   {conferenciaIa&&
    <Card>
     <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Última Conferência IA</h3>

     <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
      <div><small>STATUS</small><b style={{display:"block"}}>{conferenciaIa.statusBase||"-"}</b></div>
      <div><small>CONFIANÇA</small><b style={{display:"block"}}>{conferenciaIa.confiancaGeral||"-"}</b></div>
      <div><small>REGIME ATUAL</small><b style={{display:"block"}}>{conferenciaIa.regimeAtualConfirmado||"-"}</b></div>
      <div><small>PODE COMPARAR?</small><b style={{display:"block",color:conferenciaIa.podeCompararRegimes?C.green:C.red}}>{conferenciaIa.podeCompararRegimes?"SIM":"NÃO"}</b></div>
     </div>

     <p style={{fontSize:10.5,lineHeight:1.6,margin:"0 0 10px"}}>
      {conferenciaIa.resumo}
     </p>

     {Array.isArray(conferenciaIa.alteracoesDetectadas)&&conferenciaIa.alteracoesDetectadas.length>0&&
      <div style={{marginBottom:10}}>
       <b style={{fontSize:10}}>Alterações consideradas</b>
       <ul>{conferenciaIa.alteracoesDetectadas.map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul>
      </div>
     }

     <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
      <div>
       <b style={{fontSize:10,color:C.green}}>Dados confirmados</b>
       <ul>{(conferenciaIa.dadosConfirmados||[]).map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul>
      </div>
      <div>
       <b style={{fontSize:10,color:C.amber}}>Pontos para validar</b>
       <ul>{(conferenciaIa.pontosValidacao||[]).map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul>
      </div>
      <div>
       <b style={{fontSize:10,color:C.red}}>Dados faltantes</b>
       <ul>{(conferenciaIa.dadosFaltantes||[]).map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul>
      </div>
     </div>
    </Card>
   }

   {conferenciaIa?.qualidadeBase&&
    <Card>
     <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Qualidade da base da análise</h3>
     <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
      {[["Documental",conferenciaIa.qualidadeBase.documentalPct],["Cadastral",conferenciaIa.qualidadeBase.cadastralPct],["Manual",conferenciaIa.qualidadeBase.manualPct],["Calculado",conferenciaIa.qualidadeBase.calculadoPct],["Pendente",conferenciaIa.qualidadeBase.pendentePct]].map(([l,v])=>
       <div key={l} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:9}}>
        <small>{l.toUpperCase()}</small><b style={{display:"block",fontSize:16,marginTop:3}}>{Number(v||0).toFixed(0)}%</b>
       </div>
      )}
     </div>
     <p style={{fontSize:9.5,color:C.muted,lineHeight:1.5,marginBottom:0}}>{conferenciaIa.qualidadeBase.observacao}</p>
    </Card>
   }

   {conferenciaIa?.premissas?.length>0&&<Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Premissas utilizadas</h3>
    <ul>{conferenciaIa.premissas.map((x,i)=><li key={i} style={{fontSize:10}}>{x}</li>)}</ul>
   </Card>}

   {(conferenciaIa?.naoAplicaveis?.length>0||conferenciaIa?.periodosNaoExigiveis?.length>0)&&<Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Itens que não são pendência</h3>
    {conferenciaIa.naoAplicaveis?.length>0&&<><b style={{fontSize:10}}>Não aplicáveis</b><ul>{conferenciaIa.naoAplicaveis.map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul></>}
    {conferenciaIa.periodosNaoExigiveis?.length>0&&<><b style={{fontSize:10}}>Períodos não exigíveis / em andamento</b><ul>{conferenciaIa.periodosNaoExigiveis.map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul></>}
   </Card>}

   {conferenciaIa?.beneficiosFiscais?.length>0&&<Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Benefícios fiscais e enquadramentos especiais</h3>
    <p style={{fontSize:9.5,color:C.muted}}>Só considerar benefício com atividade real compatível, requisitos atendidos e fundamento verificável.</p>
    <div style={{display:"grid",gap:8}}>
     {conferenciaIa.beneficiosFiscais.map((b,i)=><div key={i} style={{border:`1px solid ${C.border}`,borderRadius:9,padding:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8}}><b>{b.nome}</b><b style={{fontSize:9,color:b.situacao==="APLICAVEL"?C.green:b.situacao==="POTENCIAL_VALIDAR"?C.amber:C.muted}}>{b.situacao}</b></div>
      <div style={{fontSize:9.5,lineHeight:1.55,marginTop:6}}>
       <div><b>Tributo:</b> {b.tributo||"-"}</div><div><b>Descrição:</b> {b.descricao||"-"}</div>
       <div><b>Fundamento:</b> {b.fundamentoLegal||"-"} {b.artigo?`— ${b.artigo}`:""}</div>
       <div><b>Vigência:</b> {b.vigencia||"-"}</div><div><b>Fonte oficial:</b> {b.fonteOficial||"-"}</div>
       <div><b>Jurisprudência:</b> {b.jurisprudencia||"-"}</div>
       <div><b>Efeito financeiro:</b> {b.efeitoFinanceiro!=null?moeda(b.efeitoFinanceiro):"Não calculado sem base suficiente"}</div>
      </div>
      {b.requisitos?.length>0&&<ul>{b.requisitos.map((x,j)=><li key={j} style={{fontSize:9}}>{x}</li>)}</ul>}
      {b.observacao&&<p style={{fontSize:9,color:C.muted,marginBottom:0}}>{b.observacao}</p>}
     </div>)}
    </div>
   </Card>}

   {(conferenciaIa?.riscosTributarios?.length>0||conferenciaIa?.oportunidades?.length>0)&&<Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Riscos e oportunidades</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
     <div><b style={{fontSize:10,color:C.red}}>Riscos tributários</b><ul>{(conferenciaIa.riscosTributarios||[]).map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul></div>
     <div><b style={{fontSize:10,color:C.green}}>Oportunidades</b><ul>{(conferenciaIa.oportunidades||[]).map((x,i)=><li key={i} style={{fontSize:9.5}}>{x}</li>)}</ul></div>
    </div>
   </Card>}

   {conferenciaIa?.planoAcao&&<Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>Plano de ação</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
     <div><b style={{fontSize:10}}>Imediato</b><ul>{(conferenciaIa.planoAcao.imediato||[]).map((x,i)=><li key={i} style={{fontSize:9}}>{x}</li>)}</ul></div>
     <div><b style={{fontSize:10}}>Antes de mudar regime</b><ul>{(conferenciaIa.planoAcao.antesMudancaRegime||[]).map((x,i)=><li key={i} style={{fontSize:9}}>{x}</li>)}</ul></div>
     <div><b style={{fontSize:10}}>Acompanhamento</b><ul>{(conferenciaIa.planoAcao.acompanhamento||[]).map((x,i)=><li key={i} style={{fontSize:9}}>{x}</li>)}</ul></div>
    </div>
   </Card>}

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

  {aba==="comparativo"&&<div style={{display:"grid",gap:10}}>
   <Card style={{background:"linear-gradient(135deg,#101B33,#17233D)",color:"#fff",border:0}}>
    <div style={{fontSize:8,fontWeight:900,color:"#9EBBFF"}}>MOTOR DE REGIME</div>
    <h2 style={{margin:"5px 0",fontFamily:DISPLAY}}>{recomendacaoMotor.titulo}</h2>
    <p style={{fontSize:9.5,lineHeight:1.6,color:"#D8DEEA",margin:0}}>{recomendacaoMotor.texto}</p>
   </Card>

   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
    {regimesComparativo.map(r=><Card key={r.id} style={{borderTop:`4px solid ${r.color}`}}>
     <div style={{fontSize:8,fontWeight:900,color:C.muted}}>{r.label.toUpperCase()}</div>
     <h2 style={{margin:"5px 0",fontSize:22,color:r.dados.completo?r.color:C.muted}}>{r.dados.completo?moeda(r.dados.total):"Pendente"}</h2>
     <div style={{fontSize:9,color:C.muted}}>{r.dados.completo?`Carga efetiva ${pct(r.dados.carga)}`:"Base insuficiente para cálculo"}</div>
     <div style={{marginTop:8,height:7,background:"#EEF1F5",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:r.dados.completo?`${Math.max(2,(r.dados.total/comparativoMax)*100)}%`:"0%",background:r.color}}/></div>
     <div style={{fontSize:8,marginTop:6,fontWeight:800,color:r.dados.completo?C.green:C.amber}}>{r.dados.completo?"CENÁRIO CALCULÁVEL":"COMPLETAR PREMISSAS"}</div>
    </Card>)}
   </div>

   <Card>
    <h3 style={{fontFamily:DISPLAY,margin:"0 0 4px"}}>Gráfico — comparação anual por regime</h3>
    <div style={{fontSize:8.7,color:C.muted,marginBottom:12}}>Cenários incompletos não entram no gráfico nem na escolha do menor regime.</div>
    <div style={{display:"grid",gap:10}}>
     {regimesValidos.map(r=><div key={r.id} style={{display:"grid",gridTemplateColumns:"145px 1fr 115px",gap:8,alignItems:"center",fontSize:9}}>
      <b>{r.label}</b><div style={{height:18,background:"#EEF1F5",borderRadius:6,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(2,(r.dados.total/comparativoMax)*100)}%`,background:r.color,borderRadius:6}}/></div><b style={{textAlign:"right"}}>{moeda(r.dados.total)}</b>
     </div>)}
     {!regimesValidos.length&&<div style={{padding:18,textAlign:"center",color:C.muted,fontSize:9}}>Nenhum regime calculável ainda.</div>}
    </div>
   </Card>

   <Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
     <div><small>REGIME ATUAL</small><b style={{display:"block"}}>{base.parametros.regimeAtual||"-"}</b></div>
     <div><small>MENOR CARGA MATEMÁTICA</small><b style={{display:"block"}}>{calc.melhor?.regime||"Pendente"}</b></div>
     <div><small>ECONOMIA POTENCIAL</small><b style={{display:"block",color:C.green}}>{calc.regimeAtual&&calc.melhor?moeda(calc.economia):"Pendente"}</b></div>
     <div><small>REDUÇÃO</small><b style={{display:"block",color:C.green}}>{calc.regimeAtual&&calc.melhor?pct(calc.economiaPct):"Pendente"}</b></div>
    </div>
    <div style={{marginTop:10,padding:9,background:"#FFF9EE",fontSize:9.5,color:C.amber,borderRadius:8}}>Menor carga matemática não é recomendação automática. O motor técnico considera documentação, risco, elegibilidade, folha, créditos, margem e operação real.</div>
   </Card>

   <Card>
    <h3 style={{fontFamily:DISPLAY,marginTop:0}}>DRE comparativa</h3>
    <div style={{display:"grid",gridTemplateColumns:"1.4fr repeat(3,1fr)",gap:5,fontSize:9.5}}>
     <b>Indicador</b><b>Simples</b><b>Presumido</b><b>Real</b>
     {[["Receita bruta","receitaBruta"],["Tributos","tributos"],["Receita líquida","receitaLiquida"],["CPV","cpv"],["CMV","cmv"],["CSP","csp"],["Despesas","despesas"],["Lucro líquido estimado","lucroLiquido"]].flatMap(([l,k])=>[<span key={k+"l"}>{l}</span>,<span key={k+"s"}>{moeda(calc.dre.simples[k])}</span>,<span key={k+"p"}>{moeda(calc.dre.presumido[k])}</span>,<span key={k+"r"}>{moeda(calc.dre.real[k])}</span>])}
    </div>
   </Card>
  </div>}

  {aba==="cenarios"&&<div style={{display:"grid",gap:10}}>
   <Card>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
     <div><h3 style={{fontFamily:DISPLAY,margin:"0 0 4px"}}>Cenários de crescimento</h3><div style={{fontSize:8.7,color:C.muted}}>Veja se o melhor regime continua competitivo quando a empresa cresce.</div></div>
     <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[0,10,20,30,50].map(x=><Btn key={x} secondary={crescimento!==x} onClick={()=>setCrescimento(x)}>{x===0?"Atual":`+${x}%`}</Btn>)}<input type="number" value={crescimento} onChange={e=>setCrescimento(num(e.target.value))} style={{...inp,width:95}}/></div>
    </div>
   </Card>

   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
    {regimesComparativo.map(r=><Card key={r.id} style={{borderTop:`4px solid ${r.color}`}}>
     <b>{r.label}</b><h2 style={{margin:"5px 0"}}>{r.dados.completo?moeda(r.dados.total):"Pendente"}</h2><div style={{fontSize:8.7,color:C.muted}}>Cenário selecionado: {crescimento}%</div>
    </Card>)}
   </div>

   <Card>
    <h3 style={{fontFamily:DISPLAY,margin:"0 0 4px"}}>Gráfico — sensibilidade por crescimento</h3>
    <div style={{fontSize:8.7,color:C.muted,marginBottom:12}}>Atual, +10%, +20%, +30% e +50% para os três regimes.</div>
    <div style={{overflowX:"auto"}}>
     <div style={{minWidth:760,display:"grid",gap:10}}>
      {[
       ["Simples","simples","#31589C"],
       ["Presumido","presumido","#FF6B4A"],
       ["Real","real","#17233D"]
      ].map(([label,key,color])=>{
       const vals=cenariosPadrao.map(c=>c[key]?.completo?c[key].total:0);
       const max=Math.max(...vals,1);
       return <div key={key}>
        <div style={{fontSize:9,fontWeight:900,marginBottom:5}}>{label}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
         {cenariosPadrao.map(c=><div key={c.crescimento} style={{padding:8,background:"#F7F9FC",borderRadius:8}}>
          <div style={{fontSize:8,color:C.muted}}>{c.crescimento===0?"Atual":`+${c.crescimento}%`}</div>
          <div style={{height:42,display:"flex",alignItems:"end",margin:"5px 0"}}><div style={{height:c[key]?.completo?`${Math.max(4,(num(c[key]?.total)/max)*100)}%`:"4%",width:"100%",background:c[key]?.completo?color:"#D8DEEA",borderRadius:"5px 5px 2px 2px"}}/></div>
          <b style={{fontSize:8.4}}>{c[key]?.completo?moeda(c[key].total):"Pendente"}</b>
         </div>)}
        </div>
       </div>
      })}
     </div>
    </div>
   </Card>
  </div>}

  {aba==="relatorio"&&<div style={{display:"grid",gap:10}}>
   <Card style={{borderLeft:`5px solid ${prontidao.conclusivo?C.green:prontidao.percentual>=67?C.amber:C.coral}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,flexWrap:"wrap"}}>
     <div>
      <div style={{fontSize:8,fontWeight:900,color:C.muted}}>QUALIDADE DO LAUDO</div>
      <h3 style={{margin:"4px 0"}}>{prontidao.status} · {prontidao.percentual}% pronto</h3>
      <div style={{fontSize:8.7,color:C.muted}}>O relatório só é conclusivo quando existem dados comparáveis, conferência atualizada e análise técnica.</div>
     </div>
     <Btn disabled={gerandoPdf} onClick={gerarRelatorioPdf}>{gerandoPdf?"Gerando PDF...":"Gerar PDF executivo"}</Btn>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginTop:10}}>
     {prontidao.checks.map(x=><div key={x.id} style={{fontSize:8,padding:"6px 7px",borderRadius:7,background:x.ok?"#F1FBF6":"#FFF8E7",color:x.ok?C.green:C.amber,fontWeight:800}}>{x.ok?"✓":"!"} {x.label}</div>)}
    </div>
   </Card>

   <Card style={{background:"linear-gradient(135deg,#101B33,#17233D)",color:"#fff",border:0}}>
    <div style={{fontSize:8,fontWeight:900,color:"#9EBBFF"}}>RESPOSTA EXECUTIVA</div>
    <h2 style={{fontFamily:DISPLAY,margin:"5px 0"}}>{recomendacaoMotor.titulo}</h2>
    <p style={{fontSize:9.5,lineHeight:1.65,color:"#D8DEEA"}}>{ia?.analise?.resumoExecutivo||recomendacaoMotor.texto}</p>
   </Card>

   <Card>
    <h3 style={{fontFamily:DISPLAY,margin:"0 0 4px"}}>Quanto cada regime custa por ano</h3>
    <div style={{display:"grid",gap:10,marginTop:12}}>
     {regimesComparativo.map(r=><div key={r.id} style={{display:"grid",gridTemplateColumns:"150px 1fr 120px 80px",gap:8,alignItems:"center",fontSize:9}}>
      <b>{r.label}</b>
      <div style={{height:20,background:"#EEF1F5",borderRadius:7,overflow:"hidden"}}><div style={{height:"100%",width:r.dados.completo?`${Math.max(2,(r.dados.total/comparativoMax)*100)}%`:"0%",background:r.color}}/></div>
      <b style={{textAlign:"right"}}>{r.dados.completo?moeda(r.dados.total):"Pendente"}</b>
      <span style={{textAlign:"right",color:C.muted}}>{r.dados.completo?pct(r.dados.carga):"-"}</span>
     </div>)}
    </div>
   </Card>

   <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
    <Card><div style={{fontSize:8,fontWeight:900,color:C.muted}}>MENOR CARGA MATEMÁTICA</div><div style={{fontSize:16,fontWeight:900,marginTop:5}}>{calc.melhor?.regime||"Pendente"}</div></Card>
    <Card><div style={{fontSize:8,fontWeight:900,color:C.muted}}>ECONOMIA POTENCIAL</div><div style={{fontSize:16,fontWeight:900,color:C.green,marginTop:5}}>{calc.regimeAtual&&calc.melhor?moeda(calc.economia):"Pendente"}</div></Card>
    <Card><div style={{fontSize:8,fontWeight:900,color:C.muted}}>REGIMES COMPARÁVEIS</div><div style={{fontSize:16,fontWeight:900,marginTop:5}}>{regimesValidos.length}/3</div></Card>
   </div>

   {ia?.analise&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
    <Card><b>Riscos</b><ul>{(ia.analise.riscos||[]).slice(0,7).map((x,i)=><li key={i} style={{fontSize:9,lineHeight:1.5,marginBottom:5}}>{x}</li>)}</ul></Card>
    <Card><b>Oportunidades</b><ul>{(ia.analise.oportunidades||[]).slice(0,7).map((x,i)=><li key={i} style={{fontSize:9,lineHeight:1.5,marginBottom:5}}>{x}</li>)}</ul></Card>
    <Card><b>Validações</b><ul>{(ia.analise.validacoesNecessarias||[]).slice(0,7).map((x,i)=><li key={i} style={{fontSize:9,lineHeight:1.5,marginBottom:5}}>{x}</li>)}</ul></Card>
   </div>}

   <Card>
    <div style={{fontSize:8,fontWeight:900,color:C.blue}}>PLANO EXECUTIVO</div>
    <h3 style={{margin:"4px 0"}}>Próximos 90 dias</h3>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginTop:10}}>
     {[
      ["0–30 dias",plano306090.d30,C.blue],
      ["31–60 dias",plano306090.d60,C.amber],
      ["61–90 dias",plano306090.d90,C.green]
     ].map(([fase,itens,cor])=><div key={fase} style={{border:"1px solid #E5EAF1",borderTop:`4px solid ${cor}`,borderRadius:10,padding:10}}>
      <b style={{fontSize:9.5}}>{fase}</b>{itens.length?<ol style={{paddingLeft:16,margin:"8px 0 0"}}>{itens.map((x,i)=><li key={i} style={{fontSize:8.6,lineHeight:1.5,marginBottom:5}}>{x}</li>)}</ol>:<div style={{fontSize:8.5,color:C.muted,marginTop:7}}>Aguardando análise completa.</div>}
     </div>)}
    </div>
   </Card>

   <Card style={{background:"#FFF9EE",borderColor:"#F3D99B"}}>
    <b style={{color:C.amber}}>Ressalva técnica</b>
    <p style={{fontSize:8.8,lineHeight:1.55,color:C.amber,marginBottom:0}}>Menor carga matemática não é recomendação automática. Cenários incompletos não devem aparecer como R$ 0,00 nem participar da escolha do melhor regime.</p>
   </Card>
  </div>}
    </main>
   </div>
  </div>
 </div>
}
