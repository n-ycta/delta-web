import {useEffect,useRef,useState} from 'react';
import {hierarchy,pack} from 'd3-hierarchy';
import {tr} from '@/i18n';
import type {CategoryValue} from '@/core/contracts';
import type {WidgetProps} from '../types';
import {MetricData} from '../shared';
import {useChartColors} from '@/app/theme';
import {fmtNumber} from '@/core/lib/format';
export function rankedCategories(categories:CategoryValue[],limit:number){return categories.filter(c=>Number.isFinite(c.value)&&c.value>0).sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key)).slice(0,Math.min(50,Math.max(1,limit)));}
function BubblePlot({items,colors,total}:{items:CategoryValue[];colors:string[];total:number}){
 const ref=useRef<HTMLDivElement>(null),[size,setSize]=useState({w:400,h:240});
 useEffect(()=>{const node=ref.current;if(!node)return;const o=new ResizeObserver(([e])=>setSize({w:Math.max(1,e.contentRect.width),h:Math.max(1,e.contentRect.height)}));o.observe(node);return()=>o.disconnect()},[]);
 const root=hierarchy<{item?:CategoryValue;children?:{item:CategoryValue}[]}>({children:items.map(item=>({item}))}).sum(d=>d.item?.value||0);
 const leaves=pack<typeof root.data>().size([size.w,size.h]).padding(4)(root).leaves();
 return <div className="bubble-widget"><div className="bubble-plot" ref={ref}>
  <svg width={size.w} height={size.h} role="img" aria-label={tr('analytics.bubblesDescription')}>
   {leaves.map(n=>{const d=n.data.item!;const fill=d.flagged?'var(--warn)':colors[0];return <g key={d.key} transform={`translate(${n.x},${n.y})`} tabIndex={0} role="img" aria-label={`${d.label}: ${fmtNumber(d.value,0)}${d.flagged?' · '+tr('analytics.flagged'):''}`}>
    <title>{`${d.label}: ${fmtNumber(d.value,0)} · ${(100*d.value/(total||1)).toFixed(1)}%${d.flagged?' · '+tr('analytics.flagged'):''}`}</title>
    <circle r={n.r} fill={fill} fillOpacity={.22} stroke={fill} strokeWidth={d.flagged?2:1}/>
    {n.r>=30&&<><text textAnchor="middle" y="-3" fill="var(--ink)" fontSize="12">{d.label.length>Math.floor(n.r/3)?d.label.slice(0,Math.max(3,Math.floor(n.r/3)-1))+'…':d.label}</text><text textAnchor="middle" y="14" fill="var(--ink-2)" fontSize="11">{fmtNumber(d.value,0)}</text></>}
   </g>})}
  </svg>
 </div><div className="muted" style={{fontSize:11}}>{tr('analytics.bubbleCoverage',{shown:items.length,share:total?(100*items.reduce((s,d)=>s+d.value,0)/total).toFixed(1):'0'})}</div>
 <details><summary>{tr('analytics.tableAlternative')}</summary><table className="t"><thead><tr><th>{tr('analytics.word')}</th><th>{tr('analytics.frequency')}</th></tr></thead><tbody>{items.map(d=><tr key={d.key}><td>{d.label}{d.flagged?' · '+tr('analytics.flagged'):''}</td><td className="num">{fmtNumber(d.value,0)}</td></tr>)}</tbody></table></details></div>;
}
export function BubblesWidget({config,ctx}:WidgetProps){const colors=useChartColors(config.display.palette);const groupBy=config.source.kind==='metric'?config.source.groupBy??ctx.metric?.dimensions[0]?.id:undefined;return <MetricData cfg={config} ctx={ctx} overrides={{groupBy,compare:'none'}}>{r=>{const all=r.categories||[];return <BubblePlot items={rankedCategories(all,config.display.limit??20)} colors={colors.series} total={all.reduce((s,d)=>s+Math.max(0,d.value),0)}/>}}</MetricData>}
