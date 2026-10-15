// One-time AST migration. Runtime source text lives exclusively in ru.json.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),ts=require('typescript');
const root=path.resolve(__dirname,'../src'),catalog={},index=[];
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const ru=s=>/[А-Яа-яЁё]/.test(s);
function reactText(text){const lines=text.replace(/\r/g,'').split('\n');let result='';for(let i=0;i<lines.length;i++){let s=lines[i].replace(/\t/g,' ');if(i!==0)s=s.replace(/^ +/,'');if(i!==lines.length-1)s=s.replace(/ +$/,'');if(s){result+=s;if(i!==lines.length-1)result+=' '}}return result}
for(const file of walk(root).filter(f=>/\.(ts|tsx)$/.test(f)&&!f.includes('/i18n/'))){
 const source=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[];
 const part=path.relative(root,file).replace(/\.(tsx?|ts)$/,'').replace(/[\/\\]/g,'.');
 function entry(value){const key='s_'+crypto.createHash('sha1').update(value).digest('hex').slice(0,10);catalog[part]??={};catalog[part][key]=value;return JSON.stringify(part+'.'+key)}
 function rendered(node){const begin=node.getStart(sf),end=node.end;let text=source.slice(begin,end);const nested=edits.filter(e=>e.a>=begin&&e.b<=end);for(const e of nested.sort((a,b)=>b.a-a.a))text=text.slice(0,e.a-begin)+e.text+text.slice(e.b-begin);return text}
 function visit(n){
  if(ts.isTemplateExpression(n)&&ru(n.getText(sf))){
   for(const s of n.templateSpans)visit(s.expression);
   let text=n.head.text,params=[];n.templateSpans.forEach((s,i)=>{text+=`{{p${i}}}`+s.literal.text;params.push(`p${i}: (${rendered(s.expression)})`)});
   const a=n.getStart(sf),b=n.end;for(let i=edits.length-1;i>=0;i--)if(edits[i].a>=a&&edits[i].b<=b)edits.splice(i,1);
   edits.push({a,b,text:`tr(${entry(text)}, { ${params.join(', ')} })`});return;
  }
  if(ts.isJsxText(n)){const text=reactText(n.text);if(text.trim()){edits.push({a:n.getStart(sf),b:n.end,text:`{tr(${entry(text)})}`})}return}
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){
   const parent=n.parent,text=n.text;
   const name=ts.isPropertyAssignment(parent)?parent.name.getText(sf).replace(/^['"]|['"]$/g,''):'';
   const attr=ts.isJsxAttribute(parent)?parent.name.getText(sf):'';
   const visible=ru(text)||(['label','title','description','help','reason','placeholder','message','hint','notes','output','publisher'].includes(name)&&text.length>0)||(['title','aria-label','alt','placeholder'].includes(attr)&&text.length>0)||(ts.isNewExpression(parent)&&parent.expression.getText(sf).endsWith('Error')&&text.length>0);
   // Property names, module URLs, literal types and regexes are not UI text.
   if(visible&&!(ts.isPropertyAssignment(parent)&&parent.name===n)&&!ts.isImportDeclaration(parent)&&!ts.isLiteralTypeNode(parent)){
    const expr=`tr(${entry(text)})`;edits.push({a:n.getStart(sf),b:n.end,text:attr?`{${expr}}`:expr});return;
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(sf);
 if(edits.length){let result=source;for(const e of edits.sort((a,b)=>b.a-a.a))result=result.slice(0,e.a)+e.text+result.slice(e.b);fs.writeFileSync(file,`import { tr } from '@/i18n';\n`+result);index.push({file:path.relative(root,file),count:edits.length})}
}
fs.mkdirSync(root+'/i18n',{recursive:true});fs.writeFileSync(root+'/i18n/ru.json',JSON.stringify(catalog,null,2)+'\n');fs.writeFileSync(path.resolve(__dirname,'i18n-migration.json'),JSON.stringify(index,null,2)+'\n');console.log('Extracted',Object.values(catalog).reduce((n,p)=>n+Object.keys(p).length,0),'strings from',index.length,'files');
