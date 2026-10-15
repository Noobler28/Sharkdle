const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function node() {
    const n={className:'',innerHTML:'',style:{setProperty(){},removeProperty(){}},addEventListener(name,handler){this[name]=handler;},querySelector(selector){return selector.startsWith('#')?node():null;}};
    n.classList={contains:name=>n.className.split(/\s+/).includes(name),add:name=>{n.className+=' '+name;},remove:name=>{n.className=n.className.split(/\s+/).filter(x=>x!==name).join(' ');},toggle(){}};
    return n;
}
(async()=>{
for(const path of ['Minigames/SharkRNG/rng-mode.js','SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']) {
    const timers=new Map(),storage=new Map();let id=0;
    const nodes={'rng-cutscene':node(),'rng-celebration':node(),'rng-setting-afk-mode':node()};
    const c={window:{},console,document:{getElementById:id=>nodes[id]||null,querySelector:()=>null,querySelectorAll:()=>[],body:{addEventListener(){}},addEventListener(){},createElement:node},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:key=>timers.delete(key),requestAnimationFrame:fn=>fn(),setInterval:()=>1,clearInterval(){}};
    const source=fs.readFileSync(path,'utf8').replace('    window.initRngMode = initRngMode;',`window.test={
        player:()=>player, syncAfkRevealTimers,showRarePopup,showUltraCutscene,closeRarePopup,closeUltraCutscene,saveLocalProfile,loadLocalProfile,bindUi,performRoll,
        rolling:()=>isRolling,
        mockRoll:()=>{
            GameFx.resumeAudio=GameFx.pulseRollButton=GameFx.play=()=>{};
            updateRollButtonState=maybeAwardRollinBadge=updateRngDailyQuestsForRolls=consumeRollActionEffects=scheduleCloudSync=applyRollJuice=publishRngGlobalRollBroadcast=startCooldownTimer=flushDeferredCollectionGridRender=()=>{};
            getRollCooldownMs=()=>0;getPrestigeMultiRollCount=()=>1;createRollActionContext=()=>({});animateRoll=async()=>{};
            rollForShark=()=>{player.rolls++;return {name:'Ultra test',oneIn:1e6,tier:'Ultra',oddsTier:'Ultra',className:'ultra'};};
        }
    };`);
    vm.runInNewContext(source,c);const t=c.window.test;
    const ultra={name:'Ultra test',oneIn:1e6,tier:'Ultra',oddsTier:'Ultra',className:'ultra'};
    t.showRarePopup({...ultra,oneIn:2500,oddsTier:'Legendary'});assert.equal([...timers.values()].filter(x=>x.ms===5000).length,0);t.closeRarePopup();
    t.bindUi();nodes['rng-setting-afk-mode'].change({target:{checked:true}});assert.equal(t.player().settings.afkMode,true);
    t.saveLocalProfile();t.player().settings.afkMode=false;t.loadLocalProfile();assert.equal(t.player().settings.afkMode,true);
    function fireDismiss(){const pending=[...timers.entries()].find(([,x])=>x.ms===5000);assert(pending,'AFK dismissal timer missing');timers.delete(pending[0]);pending[1].fn();}
    t.showRarePopup({...ultra,oneIn:2500,oddsTier:'Legendary'});assert(nodes['rng-celebration'].classList.contains('visible'));fireDismiss();assert(!nodes['rng-celebration'].classList.contains('visible'));
    for(const shark of [ultra,{...ultra,mutation:'chronoshark',mutations:['chronoshark']},{...ultra,mutation:'apex',mutations:['apex']}]){
        const reveal=t.showUltraCutscene(shark);assert(nodes['rng-cutscene'].classList.contains('visible'));fireDismiss();await reveal;assert(!nodes['rng-cutscene'].classList.contains('visible'));
    }
    let reveal=t.showUltraCutscene(ultra);t.closeUltraCutscene();await reveal;assert.equal([...timers.values()].filter(x=>x.ms===5000).length,0);
    reveal=t.showUltraCutscene(ultra);nodes['rng-setting-afk-mode'].change({target:{checked:false}});assert.equal([...timers.values()].filter(x=>x.ms===5000).length,0);assert(nodes['rng-cutscene'].classList.contains('visible'));t.closeUltraCutscene();await reveal;
    nodes['rng-setting-afk-mode'].change({target:{checked:true}});t.mockRoll();
    for(let i=0;i<2;i++){
        const rolling=t.performRoll();for(let j=0;j<8;j++)await Promise.resolve();assert(t.rolling());fireDismiss();await rolling;assert(!t.rolling());
    }
    assert.equal(t.player().rolls,2);
    console.log(path+': PASS default off, settings toggle/persistence, rare/Ultra/Temporal/Apex dismissal, manual close cleanup, disable cancels timer, two consecutive roll/reveal cycles resume');
}
})().catch(error=>{console.error(error);process.exitCode=1;});
