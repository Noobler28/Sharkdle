const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const path of ['Minigames/SharkRNG/rng-mode.js','SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']){
 const storage=new Map();const math=Object.create(Math);
 const c={window:{},Math:math,document:{getElementById:()=>null},console,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(c);for(const p of ['sharks.js','rays.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 const source=fs.readFileSync(path,'utf8').replace('    window.initRngMode = initRngMode;',`window.test={
   init:()=>{buildRollPool();grantRollXp=()=>{};},defs:ENDGAME_CATCH_DEFS,pool:()=>rollPool,
   mutate:applyStableMutation,roll:finalizeRoll,player:()=>player,
   candidates:getOwnedIndexCandidates,best:getBestCollectionEntry,payload:buildRngLeaderboardPayload,
   reload:()=>{saveLocalProfile();loadLocalProfile();},
   chance:getNaturalMutationChanceOneIn,pick:pickWeightedMutationKey,keys:STANDARD_MUTATION_KEYS,types:MUTATION_TYPES,total:getMutationRollWeightTotal,
   enableMutation:()=>{player.mutationLevel=320;},
   tier:tierNameFromOneIn,format:formatOneIn,icon:getMutationSpriteHtml,tierSprite:getTierSpritePath,reveal:getUltraRevealConfig,
   equip:key=>{player.equipped=key;},luck:getEquippedLuckBonus,cloud:buildRngCloudProfilePayload,
   setCollection:collection=>{player.collection=collection;}
 };`);
 vm.runInContext(source,c);const t=c.window.test;t.init();assert.equal(t.defs.length,8);assert.equal(t.keys.length,91);
 const base=t.pool().find(s=>s.name==='Ridge-egg Catshark');let max=0,previousLuck=0;
 t.enableMutation();
 for(const def of t.defs){
   assert(t.keys.includes(def.key));assert(Number.isFinite(t.chance(def.key)));assert(t.chance(def.key)>0);
   let before=0;for(const key of t.keys){if(key===def.key)break;before+=t.types[key].rollWeight;}
   math.random=()=>(before+def.rollWeight/2)/t.total();assert.equal(t.pick(),def.key);
   const roll=t.roll(t.mutate(base,def.key));assert(Number.isFinite(roll.oneIn));assert(roll.oneIn>max);max=roll.oneIn;
   assert.equal(roll.oddsTier,def.name);assert.equal(t.tier(roll.oneIn),def.name);
   const candidates=t.candidates({tierFilter:'all',ownedOnly:true,searchTokens:[def.name.toLowerCase()]});assert.equal(candidates.length,1);
   const entry=candidates[0];assert(entry.obtained);assert.equal(entry.entry.oneIn,roll.oneIn);
   t.equip(entry.key);assert(t.luck()>previousLuck);previousLuck=t.luck();
   assert(t.icon(def.key).includes('<img'));assert(t.icon(def.key).includes('loading="lazy"'));
   assert(fs.existsSync(t.tierSprite(def.name)));assert(t.reveal(roll).eyebrow.includes(def.name));
   t.reload();assert.equal(t.player().collection[entry.key].oneIn,roll.oneIn);assert.equal(t.player().equipped,entry.key);
   console.log(def.name+': '+t.format(roll.oneIn));
 }
 assert(max>1e33);const payload=t.payload({uid:'test'},{username:'Tester'});assert.equal(payload.bestOneIn,max);assert(payload.bestShark.includes('Cosmos'));

 // Previous display labels must migrate without changing rarity, counts, or equipped status.
 for(const def of t.defs){
   const variant=t.mutate(base,def.key);
   const oldKey=base.name+' ('+def.legacyName+')';
   const newKey=base.name+' ('+def.name+')';
   t.setCollection({[oldKey]:{oneIn:variant.oneIn,count:3,firstRoll:7,tier:base.tier}});
   t.equip(oldKey);t.reload();
   assert.equal(t.player().collection[newKey].oneIn,variant.oneIn);
   assert.equal(t.player().collection[newKey].count,3);
   assert.equal(t.player().equipped,newKey);
 }
 const old=t.mutate(base,'singularity');assert.equal(old.oneIn,5886000000000);
 // Expanded complete collections exceed the old 200-chunk read limit.
 const full={};for(const shark of t.pool())for(const def of t.defs)full[shark.name+' ('+def.name+')']={oneIn:1e18,count:1};
 // Model a fully unlocked index, retaining the final entry in the final chunk.
 for(let i=Object.keys(full).length;i<70000;i++)full['legacy-'+i]={oneIn:1e18,count:1};
 t.setCollection(full);const cloud=t.cloud();assert(cloud.chunks.length>200);assert(cloud.chunks.length<=400);assert.equal(cloud.chunks.flat().length,70000);
 assert(source.includes('const chunkCount = Math.min(400,'));
 console.log(path+': PASS all 8 families reachable through weighted selection; unique tiers, art, equip, save/reload, leaderboard, old 5.89T unchanged, 70,000-entry cloud payload');
}
