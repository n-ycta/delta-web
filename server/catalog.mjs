import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';import {resolve,dirname} from 'node:path';
/** Persist only declarative metadata, never credentials or executable code. */
export class ManifestCatalog {
 constructor(path=resolve(process.env.DATA_DIR||process.env.DELTA_DATA||'data','catalog.json')){this.path=path;this.items=new Map();this.tail=Promise.resolve();this.ready=this.load()}
 async load(){try{const rows=JSON.parse(await readFile(this.path,'utf8'));for(const r of rows)this.items.set(r.id,r)}catch(e){if(e.code!=='ENOENT')throw e}}
 sync(components){const p=this.tail.then(async()=>{await this.ready;let changed=false;for(const c of components.filter(c=>c.metadata?.ui)){if(JSON.stringify(this.items.get(c.id))!==JSON.stringify(c)){this.items.set(c.id,c);changed=true}}if(changed){await mkdir(dirname(this.path),{recursive:true,mode:0o700});await writeFile(this.path+'.tmp',JSON.stringify([...this.items.values()]),{mode:0o600});await rename(this.path+'.tmp',this.path)}return [...this.items.values()]});this.tail=p.catch(()=>{});return p}
}
