const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const path of ['Minigames/SharkRNG/rng-mode.js','SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']){
 const storage=new Map(),math=Object.create(Math),c={window:{},Math:math,document:{getElementById:()=>null},console,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(c);for(const p of ['sharks.js','rays.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 const source=fs.readFileSync(path,'utf8').replace('    window.initRngMode = initRngMode;',`window.test={init:()=>{buildRollPool();grantRollXp=()=>{};player.mutationLevel=320;},pool:()=>rollPool,gaps:GAP_MUTATION_DEFS,fillers:FILLER_MUTATION_DEFS,endgame:ENDGAME_MUTATION_DEFS,types:MUTATION_TYPES,keys:MUTATION_CHANCE_ORDER,standard:STANDARD_MUTATION_KEYS,total:getMutationRollWeightTotal,pick:pickWeightedMutationKey,chance:getNaturalMutationChanceOneIn,roll:finalizeRoll,mutate:applyStableMutation,candidates:getOwnedIndexCandidates,player:()=>player,equip:key=>{player.equipped=key;},reload:()=>{saveLocalProfile();loadLocalProfile();},icon:getMutationSpriteHtml,sprite:getMutationSpritePath,resolve:(input => resolveRngMutationKeys(input)[0] || null),target:getCollectionTargetCount,cloud:buildRngCloudProfilePayload,setCollection:value=>{player.collection=value;}};`);
 vm.runInContext(source,c);const t=c.window.test;t.init();
 assert.equal(t.gaps.length,36);assert.equal(t.keys.length,238);assert.equal(t.endgame.length,44);assert.equal(t.fillers.length,134);
 assert.equal(new Set(Object.values(t.types).map(v=>v.name.toLowerCase())).size,238);
 for(const key of t.keys){
   const sprite=t.sprite(key);assert(sprite.startsWith('images/RNG/mutations/')&&sprite.endsWith('.png'));
   const web=fs.readFileSync(sprite),mobile=fs.readFileSync('SharkdleMobile/www/'+sprite);
   assert.equal(web.readUInt32BE(0),0x89504e47);assert(web.readUInt32BE(16)>0&&web.readUInt32BE(20)>0);
   assert.deepEqual(mobile,web,'Mobile image matches '+key);
 }
 assert(!Object.values(t.types).some(d=>/candy.?cane|gingerbread|mistletoe|christmas|holly|festive|snowman|reindeer/i.test(d.name)));
 const animalNames='Mothwing Butterfly Dragonfly Firefly Beetle Scarab Cicada Mantis Hornet Scorpion Spider Centipede Draconic Phoenix Griffin Basilisk Chimera Hydra Gorgon Minotaur Cerberus Wyvern Gargoyle Barnacled Anemone Nautilus Cuttlefish Jellyfish Octopus Urchin Starfish Seahorse Lionfish'.split(' ');
 const foodNames='Honey Caramel Toffee Butterscotch Marshmallow Popcorn Waffle Pancake Donut Cupcake Cheesecake Brownie Fudge Truffle Lemon Lime Peach Mango Papaya Guava Lychee Coconut Pineapple Watermelon Blueberry Raspberry Blackberry Cherry Pomegranate'.split(' ');
 assert.equal(t.fillers.filter(d=>d.legacyName).length,62);
 for(const def of t.fillers){assert(!animalNames.includes(def.name));assert(!foodNames.includes(def.name));assert(!['🦋','🐉','🍯','🍋'].includes(def.icon));}
 const fillers=new Set(t.fillers.map(d=>d.key));
 const originals=t.standard.filter(key=>key!=='apex'&&!fillers.has(key)&&!t.types[key].season);
 for(let i=1;i<t.standard.length;i++){
   const lower=t.types[t.standard[i-1]],upper=t.types[t.standard[i]];
   assert(upper.oneInMult>=lower.oneInMult);assert(upper.oneInMult/lower.oneInMult<=1.5+1e-10);
   assert(upper.rollWeight<=lower.rollWeight);
 }
 for(let i=1;i<originals.length;i++)assert(t.standard.indexOf(originals[i])-t.standard.indexOf(originals[i-1])>=2,'Every original pair has a filler');
 let previous=10000,weight=.003;
 for(const d of t.endgame){assert(d.oneInMult>previous);assert(d.oneInMult/previous<=10/3+1e-12);assert(d.rollWeight<weight);assert(!/\s/.test(d.name));previous=d.oneInMult;weight=d.rollWeight;}
 const base=t.pool().find(s=>s.name==='Ridge-egg Catshark');
 for(const def of [...t.gaps,...t.fillers]){
   assert.equal(t.resolve(def.name),def.key);assert.equal(t.resolve(def.key),def.key);
   assert(t.standard.includes(def.key));assert(t.chance(def.key)>0);
   let before=0;for(const key of t.standard){if(key===def.key)break;before+=t.types[key].rollWeight;}
   math.random=()=>(before+def.rollWeight/2)/t.total();assert.equal(t.pick(),def.key);
   const rolled=t.roll(t.mutate(base,def.key));assert(Number.isFinite(rolled.oneIn));
   const entry=t.candidates({tierFilter:'all',ownedOnly:true,searchTokens:[def.name.toLowerCase()]}).find(x=>x.canonical.mutation===def.key);
   assert(entry&&entry.obtained);t.equip(entry.key);t.reload();assert.equal(t.player().equipped,entry.key);assert.equal(t.player().collection[entry.key].oneIn,rolled.oneIn);
   assert(t.icon(def.key).includes('<img'));assert(t.icon(def.key).includes('loading="lazy"'));
   assert(fs.existsSync(t.sprite(def.key)));
   if(def.legacyName){
     assert.equal(t.resolve(def.legacyName),def.key);
     const oldKey=base.name+' ('+def.legacyName+')',newKey=base.name+' ('+def.name+')';
     t.setCollection({[oldKey]:{count:3,oneIn:rolled.oneIn,firstRoll:7,tier:base.tier}});t.equip(oldKey);t.reload();
     assert.equal(t.player().collection[newKey].count,3);assert.equal(t.player().collection[newKey].oneIn,rolled.oneIn);
     assert.equal(t.player().collection[newKey].firstRoll,7);assert.equal(t.player().equipped,newKey);assert(!t.player().collection[oldKey]);
   }
 }
 // A completed index must fit in the readable chunk count and a single cloud batch.
 const complete={};for(let i=0;i<t.target();i++)complete['entry'+i]={count:1,oneIn:1e15};t.setCollection(complete);
 const payload=t.cloud();assert.equal(payload.chunks.flat().length,t.target());assert(payload.chunks.length<=400);
 assert(payload.chunks.length+1<=500);
 console.log(path+': PASS 238 active unique mutations, 134 fillers across every gap, <=1.5x steps, non-increasing pick weights, every new mutation selectable/equippable/saveable; '+t.target()+' index entries fit in '+payload.chunks.length+' cloud chunks');
}
