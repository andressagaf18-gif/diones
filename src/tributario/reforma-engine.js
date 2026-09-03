// DESTINO REAL: /src/tributario/reforma-engine.js
// Reforma Tributária V2 — motor determinístico de carga completa.
// Arquivo isolado: não altera o motor do Planejamento Tributário.

export const numero=(v)=>{
  if(typeof v==="number") return Number.isFinite(v)?v:0;
  const s=String(v??"").trim();
  if(!s)return 0;
  const n=Number((s.includes(",")?s.replace(/\./g,"").replace(",","."):s).replace(/[^\d.-]/g,""));
  return Number.isFinite(n)?n:0;
};

export const pct=(v)=>numero(v)/100;
export const moeda=(v)=>numero(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export const ANOS_TRANSICAO=[2026,2027,2028,2029,2030,2031,2032,2033];

export const TRANSICAO={
  2026:{cbsTeste:.9,ibsTeste:.1,cbsRegular:0,ibsRegular:0,pisCofins:1,icmsIss:1,ipi:1,fase:"Teste operacional"},
  2027:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:1,ibsAliquotaFixa:.1,pisCofins:0,icmsIss:1,ipi:0,fase:"CBS integral e IBS inicial"},
  2028:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:1,ibsAliquotaFixa:.1,pisCofins:0,icmsIss:1,ipi:0,fase:"CBS integral e IBS inicial"},
  2029:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:.10,pisCofins:0,icmsIss:.90,ipi:0,fase:"Transição ICMS/ISS 10%"},
  2030:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:.20,pisCofins:0,icmsIss:.80,ipi:0,fase:"Transição ICMS/ISS 20%"},
  2031:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:.30,pisCofins:0,icmsIss:.70,ipi:0,fase:"Transição ICMS/ISS 30%"},
  2032:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:.40,pisCofins:0,icmsIss:.60,ipi:0,fase:"Transição ICMS/ISS 40%"},
  2033:{cbsTeste:0,ibsTeste:0,cbsRegular:1,ibsRegular:1,pisCofins:0,icmsIss:0,ipi:0,fase:"Modelo pleno"}
};

const positivo=(v)=>Math.max(0,numero(v));
const soma=(obj,chaves)=>chaves.reduce((t,k)=>t+positivo(obj?.[k]),0);

export function regraTransicao(ano){
  const a=Math.min(2033,Math.max(2026,Math.trunc(numero(ano)||2026)));
  return {ano:a,...TRANSICAO[a]};
}

export function calcularIbsCbs(p={}){
  const fat=positivo(p.faturamento);
  const base=p.baseTributavel==null?fat:positivo(p.baseTributavel);
  const ac=Math.max(0,pct(p.aliquotaCBS)*(1-pct(p.reducaoCBS)));
  const ai=Math.max(0,pct(p.aliquotaIBS)*(1-pct(p.reducaoIBS)));
  const fatorCbs=p.fatorCbs==null?1:Math.max(0,numero(p.fatorCbs));
  const fatorIbs=p.fatorIbs==null?1:Math.max(0,numero(p.fatorIbs));
  const debitoCBS=base*ac*fatorCbs;
  const debitoIBS=base*ai*fatorIbs;
  const creditoCBS=Math.min(debitoCBS,positivo(p.creditoCBS)*fatorCbs);
  const creditoIBS=Math.min(debitoIBS,positivo(p.creditoIBS)*fatorIbs);
  const liquidoCBS=Math.max(0,debitoCBS-creditoCBS);
  const liquidoIBS=Math.max(0,debitoIBS-creditoIBS);
  const total=liquidoCBS+liquidoIBS;
  return {faturamento:fat,baseTributavel:base,debitoCBS,debitoIBS,creditoCBS,creditoIBS,
    liquidoCBS,liquidoIBS,total,cargaEfetiva:fat?total/fat*100:0,
    aliquotaCBSEfetiva:ac*100,aliquotaIBSEfetiva:ai*100,fatorCbs,fatorIbs};
}

export function calcularIrpjCsllPresumido(p={}){
  const receita=positivo(p.receita);
  const meses=Math.max(1,Math.trunc(numero(p.mesesPeriodo)||1));
  const baseIrpj=receita*pct(p.presuncaoIrpj);
  const baseCsll=receita*pct(p.presuncaoCsll);
  const irpj=baseIrpj*.15;
  const adicionalIrpj=Math.max(0,baseIrpj-20000*meses)*.10;
  const csll=baseCsll*.09;
  return {baseIrpj,baseCsll,irpj,adicionalIrpj,csll,total:irpj+adicionalIrpj+csll};
}

export function calcularIrpjCsllReal(p={}){
  const meses=Math.max(1,Math.trunc(numero(p.mesesPeriodo)||1));
  const lucroContabil=numero(p.lucroAntesIrpjCsll);
  const lucroFiscalAntesCompensacao=lucroContabil+numero(p.adicoes)-positivo(p.exclusoes);
  const prejuizoDisponivel=positivo(p.prejuizoFiscalCompensavel);
  const limiteCompensacao=Math.max(0,lucroFiscalAntesCompensacao)*.30;
  const compensacao=Math.min(prejuizoDisponivel,limiteCompensacao);
  const baseTributavel=Math.max(0,lucroFiscalAntesCompensacao-compensacao);
  const irpj=baseTributavel*.15;
  const adicionalIrpj=Math.max(0,baseTributavel-20000*meses)*.10;
  const csll=baseTributavel*.09;
  return {lucroContabil,lucroFiscalAntesCompensacao,compensacao,baseTributavel,
    irpj,adicionalIrpj,csll,total:irpj+adicionalIrpj+csll,
    houvePrejuizo:lucroFiscalAntesCompensacao<=0};
}

export function estimarDasResidualPorFora(p={}){
  const dasAtual=positivo(p.dasAtual);
  const c=p.componentes||{};
  const componentes={pis:positivo(c.pis),cofins:positivo(c.cofins),icms:positivo(c.icms),iss:positivo(c.iss),
    ipi:positivo(c.ipi),cpp:positivo(c.cpp),irpj:positivo(c.irpj),csll:positivo(c.csll),outros:positivo(c.outros)};
  const parcelasConsumo=soma(componentes,["pis","cofins","icms","iss"]);
  const somaComponentes=Object.values(componentes).reduce((a,b)=>a+b,0);
  let residual=null,metodo="PENDENTE",confianca="BAIXA";
  if(dasAtual>0&&parcelasConsumo>0){
    residual=Math.max(0,dasAtual-parcelasConsumo);
    metodo="DAS_ATUAL_MENOS_PIS_COFINS_ICMS_ISS";
    confianca="MEDIA";
  }else{
    const mantidas=soma(componentes,["cpp","irpj","csll","outros","ipi"]);
    if(mantidas>0){residual=mantidas;metodo="SOMA_COMPONENTES_RESIDUAIS_DOCUMENTAIS";confianca="MEDIA";}
  }
  const diferencaComposicao=dasAtual>0&&somaComponentes>0?dasAtual-somaComponentes:null;
  const composicaoConfere=diferencaComposicao==null?false:Math.abs(diferencaComposicao)<=Math.max(1,dasAtual*.01);
  return {dasAtual,residual,parcelasConsumo,componentes,somaComponentes,diferencaComposicao,
    composicaoConfere,metodo,confianca,
    observacao:residual==null?"Não foi possível estimar o DAS residual com os documentos disponíveis.":
      "Proxy gerencial baseado na composição atual do DAS. A partilha oficial do período deve ser validada antes da recomendação."};
}

export function calcularCargaCompleta(p={}){
  const regime=String(p.regime||"SIMPLES_NACIONAL").toUpperCase();
  const fat=positivo(p.faturamento);
  const regra=regraTransicao(p.ano);
  const atuais={
    pis:positivo(p.tributosAtuais?.pis),cofins:positivo(p.tributosAtuais?.cofins),
    icms:positivo(p.tributosAtuais?.icms),iss:positivo(p.tributosAtuais?.iss),ipi:positivo(p.tributosAtuais?.ipi),
    cpp:positivo(p.tributosAtuais?.cpp),irpj:positivo(p.tributosAtuais?.irpj),
    adicionalIrpj:positivo(p.tributosAtuais?.adicionalIrpj),csll:positivo(p.tributosAtuais?.csll),
    outros:positivo(p.tributosAtuais?.outros),das:positivo(p.tributosAtuais?.das)
  };
  const foraDAS=positivo(p.tributosForaDas);
  const baseIbsCbs=p.baseTributavel==null?fat:positivo(p.baseTributavel);
  const possuiAliquotasNovas=positivo(p.aliquotaCBS)+positivo(p.aliquotaIBS)>0;
  const parametrosNovos={faturamento:fat,baseTributavel:baseIbsCbs,
    aliquotaCBS:p.aliquotaCBS,aliquotaIBS:regra.ibsAliquotaFixa??p.aliquotaIBS,reducaoCBS:p.reducaoCBS,reducaoIBS:p.reducaoIBS,
    creditoCBS:p.creditoCBS,creditoIBS:p.creditoIBS,
    fatorCbs:regra.cbsRegular,fatorIbs:regra.ibsRegular};
  const ibsCbsRegular=calcularIbsCbs(parametrosNovos);
  const teste2026=calcularIbsCbs({faturamento:fat,baseTributavel:baseIbsCbs,
    aliquotaCBS:regra.cbsTeste,aliquotaIBS:regra.ibsTeste,reducaoCBS:p.reducaoCBS,reducaoIBS:p.reducaoIBS,
    creditoCBS:0,creditoIBS:0});
  const testeExigivel=regra.ano===2026&&!p.dispensaTeste2026?teste2026.total:0;
  const pisCofinsLegado=(atuais.pis+atuais.cofins)*regra.pisCofins;
  const icmsIssLegado=(atuais.icms+atuais.iss)*regra.icmsIss;
  const fatorIpi=p.manterIpiApos2027?1:regra.ipi;
  const ipiLegado=atuais.ipi*fatorIpi;
  const impostoSeletivo=regra.ano>=2027?positivo(p.impostoSeletivo):0;
  let irpjCsll={irpj:atuais.irpj,adicionalIrpj:atuais.adicionalIrpj,csll:atuais.csll,total:atuais.irpj+atuais.adicionalIrpj+atuais.csll};
  if(regime==="LUCRO_PRESUMIDO") irpjCsll=calcularIrpjCsllPresumido({receita:fat,presuncaoIrpj:p.presuncaoIrpj,presuncaoCsll:p.presuncaoCsll,mesesPeriodo:p.mesesPeriodo});
  if(regime==="LUCRO_REAL") irpjCsll=calcularIrpjCsllReal({lucroAntesIrpjCsll:p.lucroAntesIrpjCsll,
    adicoes:p.adicoes,exclusoes:p.exclusoes,prejuizoFiscalCompensavel:p.prejuizoFiscalCompensavel,mesesPeriodo:p.mesesPeriodo});

  const irpjCsllAtualInformado=atuais.irpj+atuais.adicionalIrpj+atuais.csll;
  const irpjCsllAtual=irpjCsllAtualInformado>0?irpjCsllAtualInformado:irpjCsll.total;
  const mantidosNaoConsumo=irpjCsll.total+atuais.cpp+atuais.outros+foraDAS;
  const cargaAtual=regime==="SIMPLES_NACIONAL"
    ? atuais.das+foraDAS
    : soma(atuais,["pis","cofins","icms","iss","ipi","cpp","outros"])+irpjCsllAtual+foraDAS;
  let totalProjetado=0;
  let simples=null;
  if(regime==="SIMPLES_NACIONAL"){
    const residual=estimarDasResidualPorFora({dasAtual:atuais.das,componentes:p.componentesDas||atuais});
    const dentro=atuais.das+foraDAS+impostoSeletivo;
    const foraCalculado=residual.residual==null?null:residual.residual+ibsCbsRegular.total+foraDAS+testeExigivel+impostoSeletivo;
    const fora=regra.ano===2026||!possuiAliquotasNovas?null:foraCalculado;
    totalProjetado=p.ibsCbsForaDoSimples?(fora??0):dentro;
    simples={dentro,fora,regular:ibsCbsRegular,dasResidualEstimado:residual,
      cargaDentro:fat?dentro/fat*100:0,cargaFora:fat&&fora!=null?fora/fat*100:null,
      diferenca:fora==null?null:fora-dentro,
      menorCargaMatematica:fora==null?"NAO_CALCULAVEL":fora<dentro?"FORA":fora>dentro?"DENTRO":"EMPATE"};
  }else{
    totalProjetado=pisCofinsLegado+icmsIssLegado+ipiLegado+ibsCbsRegular.total+testeExigivel+mantidosNaoConsumo+impostoSeletivo;
  }
  const comparavel=regra.ano!==2026&&possuiAliquotasNovas&&
    !(regime==="SIMPLES_NACIONAL"&&p.ibsCbsForaDoSimples&&simples?.fora==null);
  return {regime,faturamento:fat,ano:regra.ano,regra,cargaAtual,totalProjetado,
    diferenca:comparavel?totalProjetado-cargaAtual:null,
    variacaoPct:comparavel&&cargaAtual?((totalProjetado/cargaAtual)-1)*100:null,
    cargaEfetivaAtual:fat?cargaAtual/fat*100:0,cargaEfetivaProjetada:fat?totalProjetado/fat*100:0,
    comparavel,ibsCbs:ibsCbsRegular,teste2026,testeExigivel,pisCofinsLegado,icmsIssLegado,ipiLegado,
    irpjCsll,irpjCsllAtual,cpp:atuais.cpp,outros:atuais.outros,tributosForaDas:foraDAS,
    impostoSeletivo,fatorIpi,mantidosNaoConsumo,simples,
    avisos:[
      ...(regra.ano===2026?["2026 é fase de teste. IBS/CBS de teste não representam a carga definitiva da Reforma."]:[]),
      ...(regra.ano>2026&&!possuiAliquotasNovas?["Informe as alíquotas cheias validadas de CBS e IBS para tornar o cenário comparável."]:[]),
      ...(regime==="SIMPLES_NACIONAL"&&regra.ano>2026?["O DAS no cenário dentro é um proxy baseado no DAS informado; a partilha futura oficial deve ser validada."]:[]),
      ...(regime==="SIMPLES_NACIONAL"&&simples?.fora==null?["A comparação por fora depende da composição válida do DAS residual."]:[]),
      ...(regime==="LUCRO_REAL"&&irpjCsll.houvePrejuizo?["Há prejuízo fiscal antes de IRPJ/CSLL: IRPJ, adicional e CSLL foram zerados."]:[])
    ]};
}

// Mantido por compatibilidade com Tributario.jsx.
export function compararSimplesDentroFora(p={}){
  const fat=positivo(p.faturamento),dentro=positivo(p.dasDentro);
  const regular=calcularIbsCbs({faturamento:fat,...p.cenarioRegular});
  const dasSem=p.dasSemIbsCbs==null||String(p.dasSemIbsCbs)===""?null:positivo(p.dasSemIbsCbs);
  const fora=dasSem==null?null:dasSem+regular.total;
  return {dentro,fora,regular,cargaDentro:fat?dentro/fat*100:0,cargaFora:fat&&fora!=null?fora/fat*100:null,
    diferenca:fora==null?null:fora-dentro,
    menorCargaMatematica:fora==null?"NAO_CALCULAVEL":fora<dentro?"FORA":fora>dentro?"DENTRO":"EMPATE"};
}

export function projetarCrescimento(p={}){
  const fr=1+pct(p.crescimentoReceita),fc=1+pct(p.crescimentoCreditos);
  const atual=calcularIbsCbs({faturamento:p.faturamentoAtual,creditoCBS:p.creditoCBSAtual,creditoIBS:p.creditoIBSAtual,...p.parametros});
  const projetado=calcularIbsCbs({faturamento:numero(p.faturamentoAtual)*fr,
    creditoCBS:numero(p.creditoCBSAtual)*fc,creditoIBS:numero(p.creditoIBSAtual)*fc,...p.parametros});
  return {atual,projetado,faturamentoProjetado:numero(p.faturamentoAtual)*fr,
    aumentoImposto:projetado.total-atual.total,
    aumentoImpostoPct:atual.total?((projetado.total/atual.total)-1)*100:null};
}

export function simularPreco(p={}){
  const preco=positivo(p.precoAtual),custo=positivo(p.custoSemTributo);
  const ta=positivo(p.tributoAtual),tn=positivo(p.tributoNovo);
  const margemAtual=preco?(preco-custo-ta)/preco*100:0;
  const margemMantendoPreco=preco?(preco-custo-tn)/preco*100:0;
  const alvo=p.margemAlvoPct==null?margemAtual:numero(p.margemAlvoPct),den=1-pct(alvo);
  return {margemAtual,margemMantendoPreco,margemAlvoPct:alvo,precoParaMargem:den>0?(custo+tn)/den:null};
}
