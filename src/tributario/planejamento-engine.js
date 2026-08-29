// DESTINO REAL: /src/tributario/planejamento-engine.js
// Planejamento Tributário V2 — baseado na estrutura da planilha FS®.
// NÃO trata IBS/CBS/transição.

export const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const ROTULOS = {jan:"Jan",fev:"Fev",mar:"Mar",abr:"Abr",mai:"Mai",jun:"Jun",jul:"Jul",ago:"Ago",set:"Set",out:"Out",nov:"Nov",dez:"Dez"};

export const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  const n = Number(s.includes(",") ? s.replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"") : s.replace(/[^\d.-]/g,""));
  return Number.isFinite(n) ? n : 0;
};

export const moeda = (v) => num(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const pct = (v) => `${num(v).toFixed(2).replace(".",",")}%`;
export const mapaMes = () => Object.fromEntries(MESES.map(m => [m,0]));

export function baseVazia() {
  return {
    faturamento:{industria:mapaMes(),comercio:mapaMes(),servicos:mapaMes()},
    tributos:{pis:mapaMes(),cofins:mapaMes(),icms:mapaMes(),ipi:mapaMes(),iss:mapaMes()},
    custos:{
      industria:{estoqueInicial:mapaMes(),insumos:mapaMes(),maoObraDireta:mapaMes(),ggf:mapaMes(),estoqueFinal:mapaMes()},
      comercio:{estoqueInicial:mapaMes(),compras:mapaMes(),estoqueFinal:mapaMes()},
      servicos:{servicosInicial:mapaMes(),maoObraDireta:mapaMes(),gastosDiretos:mapaMes(),gastosIndiretos:mapaMes(),servicosFinal:mapaMes()},
    },
    despesas:{operacionais:mapaMes(),comerciais:mapaMes(),administrativas:mapaMes(),tributarias:mapaMes(),diretoria:mapaMes(),logistica:mapaMes(),ocupacao:mapaMes(),outras:mapaMes()},
    folha:{folha13:mapaMes(),proLabore:mapaMes(),inssFgts:mapaMes(),outros:mapaMes(),encargosPatronais:mapaMes()},
    creditos:{pis:mapaMes(),cofins:mapaMes(),icms:mapaMes(),ipi:mapaMes()},
    parametros:{
      regimeAtual:"",
      simplesAliquotaEfetiva:0,
      simplesDas:mapaMes(),
      presumido:{presuncaoIrpj:32,presuncaoCsll:32,pis:0.65,cofins:3,irpj:15,adicionalIrpj:10,limiteAdicionalMensal:20000,csll:9},
      real:{pis:1.65,cofins:7.6,irpj:15,adicionalIrpj:10,limiteAdicionalMensal:20000,csll:9}
    },
    fontes:[],
    divergencias:[],
    dadosFaltantes:[]
  };
}

const somaMapa = (m={}) => MESES.reduce((a,x)=>a+num(m[x]),0);
const somaMes = (...mapas) => Object.fromEntries(MESES.map(m=>[m,mapas.reduce((a,x)=>a+num(x?.[m]),0)]));
const somaGrupo = (obj={}) => Object.values(obj).reduce((acc,m)=>somaMes(acc,m),mapaMes());

export function operacional(base){
  const receita=somaMes(base.faturamento.industria,base.faturamento.comercio,base.faturamento.servicos);
  const cpv=Object.fromEntries(MESES.map(m=>[m,
    num(base.custos.industria.estoqueInicial[m])+num(base.custos.industria.insumos[m])+num(base.custos.industria.maoObraDireta[m])+num(base.custos.industria.ggf[m])-num(base.custos.industria.estoqueFinal[m])
  ]));
  const cmv=Object.fromEntries(MESES.map(m=>[m,
    num(base.custos.comercio.estoqueInicial[m])+num(base.custos.comercio.compras[m])-num(base.custos.comercio.estoqueFinal[m])
  ]));
  const csp=Object.fromEntries(MESES.map(m=>[m,
    num(base.custos.servicos.servicosInicial[m])+num(base.custos.servicos.maoObraDireta[m])+num(base.custos.servicos.gastosDiretos[m])+num(base.custos.servicos.gastosIndiretos[m])-num(base.custos.servicos.servicosFinal[m])
  ]));
  const custos=somaMes(cpv,cmv,csp);
  const despesas=somaGrupo(base.despesas);
  const massa=somaMes(base.folha.folha13,base.folha.proLabore,base.folha.inssFgts,base.folha.outros);
  return {
    receita,cpv,cmv,csp,custos,despesas,massa,
    totalReceita:somaMapa(receita), totalCustos:somaMapa(custos), totalDespesas:somaMapa(despesas), totalMassa:somaMapa(massa)
  };
}

export function fatorR(base){
  const o=operacional(base);
  const fator=o.totalReceita>0?o.totalMassa/o.totalReceita:0;
  return {rbt12:o.totalReceita,massa:o.totalMassa,fator,percentual:fator*100,atinge28:fator>=0.28};
}

function adicional(base,taxa,limite){ return Math.max(0,num(base)-num(limite))*(num(taxa)/100); }

export function simples(base){
  const o=operacional(base), p=base.parametros;
  const dasInformado=somaMapa(p.simplesDas);
  const mensal=Object.fromEntries(MESES.map(m=>[m,
    dasInformado>0?num(p.simplesDas[m]):num(o.receita[m])*(num(p.simplesAliquotaEfetiva)/100)
  ]));
  const total=somaMapa(mensal);
  return {regime:"SIMPLES_NACIONAL",mensal,total,carga:o.totalReceita?total/o.totalReceita*100:0,completo:dasInformado>0||num(p.simplesAliquotaEfetiva)>0};
}

export function presumido(base){
  const o=operacional(base),p=base.parametros.presumido;
  const mensal=MESES.map(m=>{
    const r=num(o.receita[m]), bir=r*num(p.presuncaoIrpj)/100, bcs=r*num(p.presuncaoCsll)/100;
    const pis=r*num(p.pis)/100, cof=r*num(p.cofins)/100, ir=bir*num(p.irpj)/100, ad=adicional(bir,p.adicionalIrpj,p.limiteAdicionalMensal), cs=bcs*num(p.csll)/100;
    const iss=num(base.tributos.iss[m]),icms=num(base.tributos.icms[m]),ipi=num(base.tributos.ipi[m]),enc=num(base.folha.encargosPatronais[m]);
    return {mes:m,pis,cofins:cof,irpj:ir,adicionalIrpj:ad,csll:cs,iss,icms,ipi,encargos:enc,total:pis+cof+ir+ad+cs+iss+icms+ipi+enc};
  });
  const total=mensal.reduce((a,x)=>a+x.total,0);
  return {regime:"LUCRO_PRESUMIDO",mensal,total,carga:o.totalReceita?total/o.totalReceita*100:0,completo:num(p.presuncaoIrpj)>0&&num(p.presuncaoCsll)>0};
}

export function real(base){
  const o=operacional(base),p=base.parametros.real;
  const mensal=MESES.map(m=>{
    const r=num(o.receita[m]);
    const pis=Math.max(0,r*num(p.pis)/100-num(base.creditos.pis[m]));
    const cof=Math.max(0,r*num(p.cofins)/100-num(base.creditos.cofins[m]));
    const iss=num(base.tributos.iss[m]);
    const icms=Math.max(0,num(base.tributos.icms[m])-num(base.creditos.icms[m]));
    const ipi=Math.max(0,num(base.tributos.ipi[m])-num(base.creditos.ipi[m]));
    const enc=num(base.folha.encargosPatronais[m]),cust=num(o.custos[m]),desp=num(o.despesas[m]);
    const lucro=Math.max(0,r-cust-desp-pis-cof-iss-icms-ipi-enc);
    const ir=lucro*num(p.irpj)/100,ad=adicional(lucro,p.adicionalIrpj,p.limiteAdicionalMensal),cs=lucro*num(p.csll)/100;
    return {mes:m,pis,cofins:cof,iss,icms,ipi,encargos:enc,lucroAntesIrCs:lucro,irpj:ir,adicionalIrpj:ad,csll:cs,total:pis+cof+iss+icms+ipi+enc+ir+ad+cs};
  });
  const total=mensal.reduce((a,x)=>a+x.total,0);
  return {regime:"LUCRO_REAL",mensal,total,carga:o.totalReceita?total/o.totalReceita*100:0,completo:o.totalReceita>0};
}

export function comparar(base){
  const s=simples(base),p=presumido(base),r=real(base),fr=fatorR(base),o=operacional(base);
  const validos=[s.completo?s:null,p.completo?p:null,r.completo?r:null].filter(Boolean).sort((a,b)=>a.total-b.total);
  const melhor=validos[0]||null;
  const mapa={SIMPLES:s,SIMPLES_NACIONAL:s,PRESUMIDO:p,LUCRO_PRESUMIDO:p,REAL:r,LUCRO_REAL:r};
  const atual=mapa[String(base.parametros.regimeAtual||"").toUpperCase()]||null;
  const economia=atual&&melhor?Math.max(0,atual.total-melhor.total):0;
  const dre=(reg)=>({receitaBruta:o.totalReceita,tributos:reg.total,receitaLiquida:o.totalReceita-reg.total,cpv:somaMapa(o.cpv),cmv:somaMapa(o.cmv),csp:somaMapa(o.csp),despesas:o.totalDespesas,lucroLiquido:o.totalReceita-reg.total-o.totalCustos-o.totalDespesas});
  return {simples:s,presumido:p,real:r,fatorR:fr,melhor,regimeAtual:atual,economia,economiaPct:atual?.total?economia/atual.total*100:0,dre:{simples:dre(s),presumido:dre(p),real:dre(r)}};
}

export function cenario(base,crescimento=0){
  const c=JSON.parse(JSON.stringify(base)),f=1+num(crescimento)/100;
  ["industria","comercio","servicos"].forEach(g=>MESES.forEach(m=>{c.faturamento[g][m]=num(base.faturamento[g][m])*f;}));
  return c;
}
