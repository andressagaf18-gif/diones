// DESTINO: /src/tributario/reforma-engine.js
// NOVO ARQUIVO ISOLADO. NÃO ALTERA O PLANEJAMENTO TRIBUTÁRIO.

export const numero=(v)=>{
  if(typeof v==="number") return Number.isFinite(v)?v:0;
  const s=String(v??"").trim();
  if(!s)return 0;
  const n=Number((s.includes(",")?s.replace(/\./g,"").replace(",","."):s).replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
};
export const pct=(v)=>numero(v)/100;
export const moeda=(v)=>numero(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function calcularIbsCbs(p={}){
 const fat=Math.max(0,numero(p.faturamento));
 const base=p.baseTributavel==null?fat:Math.max(0,numero(p.baseTributavel));
 const ac=Math.max(0,pct(p.aliquotaCBS)*(1-pct(p.reducaoCBS)));
 const ai=Math.max(0,pct(p.aliquotaIBS)*(1-pct(p.reducaoIBS)));
 const debitoCBS=base*ac, debitoIBS=base*ai;
 const creditoCBS=Math.max(0,numero(p.creditoCBS)), creditoIBS=Math.max(0,numero(p.creditoIBS));
 const liquidoCBS=Math.max(0,debitoCBS-creditoCBS), liquidoIBS=Math.max(0,debitoIBS-creditoIBS);
 const total=liquidoCBS+liquidoIBS;
 return {faturamento:fat,baseTributavel:base,debitoCBS,debitoIBS,creditoCBS,creditoIBS,
  liquidoCBS,liquidoIBS,total,cargaEfetiva:fat?total/fat*100:0,
  aliquotaCBSEfetiva:ac*100,aliquotaIBSEfetiva:ai*100};
}

export function estimarDasResidualPorFora(p={}){
 const dasAtual=Math.max(0,numero(p.dasAtual));
 const componentes=p.componentes||{};
 const valores={
  pis:Math.max(0,numero(componentes.pis)),
  cofins:Math.max(0,numero(componentes.cofins)),
  icms:Math.max(0,numero(componentes.icms)),
  iss:Math.max(0,numero(componentes.iss)),
  ipi:Math.max(0,numero(componentes.ipi)),
  cpp:Math.max(0,numero(componentes.cpp)),
  irpj:Math.max(0,numero(componentes.irpj)),
  csll:Math.max(0,numero(componentes.csll)),
  outros:Math.max(0,numero(componentes.outros))
 };

 // Proxy gerencial: retira da composição atual os tributos sobre consumo
 // que serão substituídos pela CBS/IBS no modelo pleno.
 // Não representa a futura tabela oficial do Simples.
 const parcelasConsumo=
  valores.pis+
  valores.cofins+
  valores.icms+
  valores.iss;

 const somaComponentes=Object.values(valores).reduce((a,b)=>a+b,0);

 let residual=null;
 let metodo="PENDENTE";
 let confianca="BAIXA";

 if(dasAtual>0&&parcelasConsumo>0){
  residual=Math.max(0,dasAtual-parcelasConsumo);
  metodo="DAS_ATUAL_MENOS_PIS_COFINS_ICMS_ISS";
  confianca="MEDIA";
 }else{
  const parcelasMantidas=
   valores.cpp+
   valores.irpj+
   valores.csll+
   valores.outros+
   valores.ipi;

  if(parcelasMantidas>0){
   residual=parcelasMantidas;
   metodo="SOMA_COMPONENTES_RESIDUAIS_DOCUMENTAIS";
   confianca="MEDIA";
  }
 }

 const diferencaComposicao=
  dasAtual>0&&somaComponentes>0
   ? dasAtual-somaComponentes
   : null;

 return{
  dasAtual,
  residual,
  parcelasConsumo,
  componentes:valores,
  somaComponentes,
  diferencaComposicao,
  metodo,
  confianca,
  observacao:
   residual==null
    ?"Não foi possível estimar o DAS residual com os documentos disponíveis."
    :"Estimativa gerencial baseada na composição documental atual. A guia futura deve ser recalculada com a tabela/partilha do Simples vigente no período."
 };
}

export function compararSimplesDentroFora(p={}){
 const fat=Math.max(0,numero(p.faturamento));
 const dentro=Math.max(0,numero(p.dasDentro));
 const regular=calcularIbsCbs({faturamento:fat,...p.cenarioRegular});
 const dasSem=p.dasSemIbsCbs==null||String(p.dasSemIbsCbs)===""?null:Math.max(0,numero(p.dasSemIbsCbs));
 const fora=dasSem==null?null:dasSem+regular.total;
 return {dentro,fora,regular,
  cargaDentro:fat?dentro/fat*100:0,cargaFora:fat&&fora!=null?fora/fat*100:null,
  diferenca:fora==null?null:fora-dentro,
  menorCargaMatematica:fora==null?"NAO_CALCULAVEL":fora<dentro?"FORA":fora>dentro?"DENTRO":"EMPATE"};
}

export function projetarCrescimento(p={}){
 const fr=1+pct(p.crescimentoReceita), fc=1+pct(p.crescimentoCreditos);
 const atual=calcularIbsCbs({faturamento:p.faturamentoAtual,creditoCBS:p.creditoCBSAtual,creditoIBS:p.creditoIBSAtual,...p.parametros});
 const projetado=calcularIbsCbs({faturamento:numero(p.faturamentoAtual)*fr,creditoCBS:numero(p.creditoCBSAtual)*fc,creditoIBS:numero(p.creditoIBSAtual)*fc,...p.parametros});
 return {atual,projetado,faturamentoProjetado:numero(p.faturamentoAtual)*fr,
  aumentoImposto:projetado.total-atual.total,
  aumentoImpostoPct:atual.total?((projetado.total/atual.total)-1)*100:null};
}

export function simularPreco(p={}){
 const preco=Math.max(0,numero(p.precoAtual)), custo=Math.max(0,numero(p.custoSemTributo));
 const ta=Math.max(0,numero(p.tributoAtual)), tn=Math.max(0,numero(p.tributoNovo));
 const margemAtual=preco?(preco-custo-ta)/preco*100:0;
 const margemMantendoPreco=preco?(preco-custo-tn)/preco*100:0;
 const alvo=p.margemAlvoPct==null?margemAtual:numero(p.margemAlvoPct), den=1-pct(alvo);
 return {margemAtual,margemMantendoPreco,margemAlvoPct:alvo,precoParaMargem:den>0?(custo+tn)/den:null};
}
