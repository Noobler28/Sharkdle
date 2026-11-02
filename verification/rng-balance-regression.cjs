const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const path of ['Minigames/SharkRNG/rng-mode.js','SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']){
 const original=fs.readFileSync(path,'utf8');
 const context=()=>{const storage=new Map(),math=Object.create(Math);let seed=123456789;math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};const c={window:{},Math:math,document:{getElementById:()=>null},console,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:()=>1,clearTimeout(){}};vm.createContext(c);for(const p of ['sharks.js','rays.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);return c;};
 const c=context();const source=original.replace('    window.initRngMode = initRngMode;',`window.test={init:()=>buildRollPool(),pick:pickTierForRoll,base:getTierMeta,types:TIERS,chance:getMutationChance,next:()=>getNextUpgrade(MUTATION_LUCK_UPGRADES,player.mutationLevel),player:()=>player,source:()=>rollPool};`);vm.runInContext(source,c);const t=c.window.test;t.init();
 const low=new Set(['Common','Uncommon','Rare','Epic']);let lowNormal=0,lowMutation=0,commonMutation=0;const draws=Number(process.env.RNG_BALANCE_DRAWS)||20000;
 for(let i=0;i<draws;i++){
   if(low.has(t.pick(23014018833.53)))lowNormal++;
   const tier=t.pick(23014018833.53,{mutation:true});if(low.has(tier))lowMutation++;if(tier==='Common')commonMutation++;
 }
 assert(lowNormal/draws>.28&&lowNormal/draws<.36);assert(lowMutation/draws>.75&&lowMutation/draws<.83);assert(commonMutation/draws>.53);
 // Inspect the exact normalized probabilities, including extreme finite luck.
 const p=context();const probe=original.replace('        let rng = Math.random();\n        for (const entry of weightedTiers)', '        return weightedTiers;\n        let rng = Math.random();\n        for (const entry of weightedTiers)').replace('    window.initRngMode = initRngMode;','    window.init=buildRollPool;window.weights=pickTierForRoll;window.meta=getTierMeta;');vm.runInContext(probe,p);p.window.init();
 for(const mutation of [false,true]){
   let previous=-1;
   for(const luck of [1,450,3600,23014018833.53,1e100,Number.MAX_VALUE]){
     const weights=p.window.weights(luck,{mutation});const sum=weights.reduce((s,e)=>s+e.weight,0);assert(Math.abs(sum-1)<1e-12);
     const baselineTotal=weights.reduce((s,e)=>s+1/p.window.meta(e.tier).baseOneIn,0),share=mutation?.75:.2;
     for(const e of weights){assert(Number.isFinite(e.weight)&&e.weight>0);const floor=share/(p.window.meta(e.tier).baseOneIn*baselineTotal);assert(e.weight>=floor-1e-15);}
     const mean=weights.reduce((s,e,i)=>s+i*e.weight,0);assert(mean>=previous-1e-12);previous=mean;
   }
 }
 t.player().mutationLevel=320;t.player().prestigeLevel=10000;t.player().prestigeUpgrades={mutagenArchive:5};assert.equal(t.chance(),2);assert.equal(t.next(),null);
 t.player().mutationLevel=0;t.player().prestigeLevel=0;t.player().prestigeUpgrades={};assert.equal(t.chance(),null);
 assert(original.includes('const picked = pickMutationBaseShark();'));
 assert(original.includes('pickTierForRoll(luck, { mutation: Boolean(hasForcedMutation) })'));
 console.log(path+': PASS '+(draws*2).toLocaleString()+' sampled picks; '+(lowNormal/draws*100).toFixed(1)+'% normal and '+(lowMutation/draws*100).toFixed(1)+'% mutation bases Common–Epic; all tiers retain probability; luck improves distributions; natural mutation rate <=50%; capped upgrade not sold');
}
