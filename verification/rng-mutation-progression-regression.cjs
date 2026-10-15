const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const path of ['Minigames/SharkRNG/rng-mode.js','SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']){
 const storage=new Map(),math=Object.create(Math),c={window:{},Math:math,document:{getElementById:()=>null},console,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(c);for(const p of ['sharks.js','rays.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 const source=fs.readFileSync(path,'utf8').replace('    window.initRngMode = initRngMode;',`window.test={init:()=>{buildRollPool();grantRollXp=()=>{};player.mutationLevel=320;},pool:()=>rollPool,gaps:GAP_MUTATION_DEFS,endgame:ENDGAME_MUTATION_DEFS,types:MUTATION_TYPES,keys:MUTATION_CHANCE_ORDER,standard:STANDARD_MUTATION_KEYS,total:getMutationRollWeightTotal,pick:pickWeightedMutationKey,chance:getNaturalMutationChanceOneIn,roll:finalizeRoll,mutate:applyStableMutation,candidates:getOwnedIndexCandidates,player:()=>player,equip:key=>{player.equipped=key;},reload:()=>{saveLocalProfile();loadLocalProfile();},icon:getMutationSpriteHtml,target:getCollectionTargetCount,cloud:buildRngCloudProfilePayload,setCollection:value=>{player.collection=value;}};`);
 vm.runInContext(source,c);const t=c.window.test;t.init();
 assert.equal(t.gaps.length,36);assert.equal(t.keys.length,92);assert.equal(t.endgame.length,44);
 assert.equal(new Set(Object.values(t.types).map(v=>v.name.toLowerCase())).size,92);
 let previous=10000,weight=.003;
 for(const d of t.endgame){assert(d.oneInMult>previous);assert(d.oneInMult/previous<=10/3+1e-12);assert(d.rollWeight<weight);assert(!/\s/.test(d.name));previous=d.oneInMult;weight=d.rollWeight;}
 const base=t.pool().find(s=>s.name==='Ridge-egg Catshark');
 for(const def of t.gaps){
   assert(t.standard.includes(def.key));assert(t.chance(def.key)>0);
   let before=0;for(const key of t.standard){if(key===def.key)break;before+=t.types[key].rollWeight;}
   math.random=()=>(before+def.rollWeight/2)/t.total();assert.equal(t.pick(),def.key);
   const rolled=t.roll(t.mutate(base,def.key));assert(Number.isFinite(rolled.oneIn));
   const entry=t.candidates({tierFilter:'all',ownedOnly:true,searchTokens:[def.name.toLowerCase()]}).find(x=>x.canonical.mutation===def.key);
   assert(entry&&entry.obtained);t.equip(entry.key);t.reload();assert.equal(t.player().equipped,entry.key);assert.equal(t.player().collection[entry.key].oneIn,rolled.oneIn);
   assert(t.icon(def.key).includes('<img'));assert(t.icon(def.key).includes('loading="lazy"'));
 }
 // A full newly expanded collection must fit within the readable cloud chunk count.
 const complete={};for(let i=0;i<t.target();i++)complete['entry'+i]={count:1,oneIn:1e15};t.setCollection(complete);
 const payload=t.cloud();assert.equal(payload.chunks.flat().length,t.target());assert(payload.chunks.length<=400);
 console.log(path+': PASS 92 unique mutations, 36 new one-word names, <=3.34x gaps, decreasing pick weights, every new mutation selectable/equippable/saveable; '+t.target()+' index entries fit in '+payload.chunks.length+' cloud chunks');
}
