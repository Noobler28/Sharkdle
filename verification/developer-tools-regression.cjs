const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
function database(){
 const records=new Map(),versions=new Map();let failUid='',offline=false,writes=0;
 const put=(p,v)=>{records.set(p,clone(v));versions.set(p,(versions.get(p)||0)+1);};
 const snap=p=>({id:p.split('/').at(-1),exists:records.has(p),data:()=>clone(records.get(p))});
 function ref(p){return {path:p,collection:n=>collection(p+'/'+n),get:async()=>{if(offline)throw Error('offline');return snap(p);},set:async(v,o)=>{if(offline)throw Error('offline');put(p,o?.merge?{...records.get(p),...clone(v)}:v);writes++;}};}
 function collection(p){let field,cutoff,sort,limit=Infinity;return {doc:id=>ref(p+'/'+id),where:(f,op,v)=>{field=f;cutoff=v;return collectionQuery();},orderBy:(f,d)=>{sort=f;return collectionQuery();}};
 function collectionQuery(){return {limit:n=>{limit=n;return collectionQuery();},get:async()=>{if(offline)throw Error('offline');const docs=[...records.keys()].filter(k=>k.startsWith(p+'/')&&k.split('/').length===p.split('/').length+1).map(snap).filter(d=>!field||d.data()[field]>=cutoff).sort((a,b)=>sort?b.data()[sort]-a.data()[sort]:0).slice(0,limit);return {docs};}};}}
 return {records,put,collection,writes:()=>writes,fail:uid=>{failUid=uid;},offline:v=>{offline=v;},async runTransaction(fn){for(let attempt=0;attempt<30;attempt++){
  if(offline)throw Error('offline');const reads=new Map(),pending=new Map();
  const result=await fn({get:async r=>{reads.set(r.path,versions.get(r.path)||0);return snap(r.path);},set:(r,v,o)=>pending.set(r.path,{v:clone(v),merge:o?.merge})});
  if(offline)throw Error('offline');
  if(failUid&&pending.has('userStats/'+failUid))throw Error('simulated connection failure');
  if([...reads].some(([p,v])=>(versions.get(p)||0)!==v))continue;
  for(const [p,{v,merge}]of pending){put(p,merge?{...records.get(p),...v}:v);writes++;}return result;
 }throw Error('conflict');}};
}
function harness(root){
 const db=database();const c=vm.createContext({console,Date,Math,db,currentUser:{uid:'DEV',emailVerified:true},isDeveloperSessionActive:()=>c.currentUser?.uid==='DEV',
  normalizeCrateInventory:v=>({reef:0,halloween:0,christmas:0,...v}),getStreakShieldCount:v=>Math.min(3,Math.max(0,Number(v.streakShields)||0)),normalizeDailySpinBonusCount:v=>Math.max(0,Number(v)||0),getAdminTimestampMillis:v=>Number(v)||0,
  getLevelFromXP:v=>Math.floor(v/100)+1,getXPForLevel:l=>(l-1)*100,
  buildAdminLevelSyncPayload:totalXP=>({totalXP}),buildSharkPassXpGrantPayload:(v,n)=>({sharkPassXP:(v.sharkPassXP||0)+n}),
  setAdminAbuseStatus(){},document:{getElementById:()=>null,querySelectorAll:()=>[]}});c.window=c;
 const script=fs.readFileSync(root+'script.js','utf8');
 const a=script.indexOf('const ADMIN_COMPENSATION_TYPES ='),b=script.indexOf('async function compensatePlayer',a);
 vm.runInContext(script.slice(a,b),c);vm.runInContext(fs.readFileSync(root+'developer-tools.js','utf8'),c);
 return {db,c,api:c.SharkdleAdminTools,script};
}
(async()=>{for(const root of ['', 'SharkdleMobile/www/']){
 const {db,c,api,script}=harness(root);const now=Date.now();
 for(const [uid,lastActive,label] of [['A',now,'Daily'],['B',now,'Shark RNG'],['C',now-10*60000,'Daily'],['D',now+5*60000,'Daily']])db.put('userStats/'+uid,{username:uid,lastActive,lastActivity:{label},pearls:5,totalXP:100,sharkPassXP:25,streakShields:2,crateInventory:{reef:4,christmas:2},custom:'preserved'});
 const rewards={xp:500,pearls:100,crates:2,christmas:1,halloween:1,spins:2,streak_shields:3};
 for(const bad of [{xp:-1},{pearls:1.5},{spins:Infinity},{unknown:1},{},{streak_shields:4}])assert.throws(()=>api.normalizeRewards(bad));
 assert.equal((await api.onlinePlan(rewards,'daily')).recipients.length,1);
 const plan=await api.onlinePlan(rewards);assert.equal(plan.recipients.length,2,'Only currently active signed-in accounts');
 await Promise.all([api.execute(plan),api.execute(plan)]);
 for(const uid of ['A','B']){const p=db.records.get('userStats/'+uid);assert.equal(p.pearls,105);assert.equal(p.totalXP,600);assert.equal(p.sharkPassXP,525);assert.equal(p.streakShields,3);assert.equal(p.crateInventory.reef,6);assert.equal(p.crateInventory.christmas,3);assert.equal(p.crateInventory.halloween,1);assert.equal(p.dailySpinBonusSpins,2);assert.equal(p.custom,'preserved');assert.equal(p.adminCompensationNotice.grants.length,7);}
 await api.execute({id:plan.id},true);assert.equal(db.records.get('userStats/A').pearls,105,'Resume never duplicates');
 db.fail('B');const partial=await api.onlinePlan({pearls:10});const failed=await api.execute(partial);assert.equal(failed.failed,1);assert.equal(db.records.get('userStats/A').pearls,115);assert.equal(db.records.get('userStats/B').pearls,105);
 db.fail('');await api.execute({id:partial.id},true);assert.equal(db.records.get('userStats/A').pearls,115);assert.equal(db.records.get('userStats/B').pearls,115);
 const shields=await api.onlinePlan({streak_shields:1});const skipped=await api.execute(shields);assert.equal(skipped.skipped,2,'Full shields skipped without breaking giveaway');
 const old=await api.onlinePlan({pearls:1});old.createdAt-=120001;await assert.rejects(()=>api.execute(old),/Refresh/);
 const savedWrites=db.writes();c.currentUser={uid:'ordinary',emailVerified:true};await assert.rejects(()=>api.onlinePlan(rewards),/developer/);await assert.rejects(()=>api.execute(plan),/developer/);assert.equal(db.writes(),savedWrites);
 c.currentUser={uid:'DEV',emailVerified:false};await assert.rejects(()=>api.execute({id:plan.id},true),/developer/);
 c.currentUser={uid:'DEV',emailVerified:true};db.offline(true);await assert.rejects(()=>api.execute({id:plan.id},true),/offline/);db.offline(false);
 // Actual own-all command: atomic persistence, retained inventory, no account-XP alteration.
 Object.assign(c,{collectAllUnlockablePfps:()=>[{name:'New',imagePath:'new.png'}],collectAllUnlockableBadgeIds:()=>['starter','dev'],getActiveSharkPassSeason:()=>({id:'season'}),sharkPassRewards:[{level:30}],sharkPassCardThemes:[{id:'default'},{id:'new-theme'}],profileTitleDefs:[{id:''},{id:'new-title'}],getUnifiedCosmeticList:(a=[],b=[])=>[...a,...b.filter(v=>!a.some(x=>x.imagePath===v.imagePath))],loadUserProfile:async()=>{},renderThemeSelection(){},loadEarnedCosmetics(){},updateProfileBadgeUI(){},renderTitleSelection(){},showNotification(){}});
 const start=script.indexOf('window.unlockAllCosmetics = async function() {'),end=script.indexOf('window.resetDailySpin =',start);vm.runInContext(script.slice(start,end),c);
 db.put('userStats/DEV',{totalXP:42,pearls:123,earnedCosmetics:[{imagePath:'old.png'}],unlockedBadges:['old'],unlockedCardThemes:['old-theme'],unlockedTitles:['old-title']});
 await c.unlockAllCosmetics();const dev=db.records.get('userStats/DEV');assert.equal(dev.totalXP,42);assert.equal(dev.pearls,123);assert.equal(dev.earnedCosmetics.length,2);assert(dev.unlockedTitles.includes('new-title'));assert(dev.unlockedBadges.includes('old'));assert.equal(dev.sharkPassXP,2900);
 await c.unlockAllCosmetics();assert.equal(db.records.get('userStats/DEV').earnedCosmetics.length,2);
 c.currentUser={uid:'ordinary'};await assert.rejects(()=>c.unlockAllCosmetics(),/developer/);
 const html=fs.readFileSync(root+'index.html','utf8');for(const fn of ['adminOwnAllCosmetics','adminSelfReward','adminPreviewDrop','adminSendDrop','adminRefreshDropHistory'])assert(html.includes(fn+'('));
 console.log(root||'web','PASS developer-only inventory, all-cosmetic save, online filters, bundles, caps, atomic receipts, concurrent sends, partial retry, offline errors and expiry');
}
assert.equal(fs.readFileSync('developer-tools.js','utf8'),fs.readFileSync('SharkdleMobile/www/developer-tools.js','utf8'));
})().catch(e=>{console.error(e);process.exitCode=1;});
