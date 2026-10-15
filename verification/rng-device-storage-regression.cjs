const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function fakeIndexedDB(records) {
    let failed=false;
    return {
        fail(value){failed=value;},
        open(){
            const request={};
            queueMicrotask(()=>{
                request.result={
                    close(){},
                    transaction(){
                        const tx={};
                        tx.objectStore=()=>({
                            put(value,key){const op={};queueMicrotask(()=>{
                                if(failed){tx.error=Error('Database unavailable');tx.onabort();return;}
                                records.set(key,value);op.result=key;op.onsuccess();tx.oncomplete();
                            });return op;},
                            get(key){const op={};queueMicrotask(()=>{op.result=records.get(key);op.onsuccess();tx.oncomplete();});return op;}
                        });return tx;
                    }
                };request.onsuccess();
            });return request;
        }
    };
}
function harness(path,records,local) {
    const ids=['rng-save-status','rng-save-local','rng-save-cloud'];
    const nodes=Object.fromEntries(ids.map(id=>[id,{dataset:{},textContent:''}]));
    let quotaFull=true;
    const c={window:{},document:{getElementById:id=>nodes[id]||null},console:{warn(){}},indexedDB:fakeIndexedDB(records),setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>{if(quotaFull)throw Error('QuotaExceededError');local.set(key,value);}}};
    const s=fs.readFileSync(path,'utf8').replace('    window.initRngMode = initRngMode;',`window.test={saveLocalProfile,loadDeviceProfile,applyRngProfileData,scheduleLocalProfileSave,player:()=>player,setPlayer:(p)=>{player={...createDefaultPlayer(),...p};},mockUi:()=>{updateAllUi=updateSettingsUi=()=>{};}};`);
    vm.runInNewContext(s,c);
    return {api:c.window.test,nodes,db:c.indexedDB,quota:value=>{quotaFull=value;}};
}
(async()=>{
for(const path of ['Minigames/SharkRNG/rng-mode.js','SharkdleMobile/www/Minigames/SharkRNG/rng-mode.js']){
    const records=new Map(),local=new Map();
    const stale={bestOneIn:44e9,rngDeviceSavedAtMs:1,rngXpCurveVersion:3};local.set('sharkRngProfile',JSON.stringify(stale));
    let h=harness(path,records,local),t=h.api;
    t.setPlayer({bestOneIn:1975890000000,potions:{coin:7},coins:321});
    const write=t.saveLocalProfile();assert.equal(h.nodes['rng-save-local'].textContent,'Saving on device...');
    assert.equal(await write,true);assert.equal(h.nodes['rng-save-local'].textContent,'Saved on device');
    assert.equal(JSON.parse(local.get('sharkRngProfile')).bestOneIn,44e9);
    h=harness(path,records,local);t=h.api;await t.loadDeviceProfile();
    assert.equal(t.player().bestOneIn,1975890000000);assert.equal(t.player().potions.coin,7);assert.equal(t.player().coins,321);
    t.player().coins=111;t.scheduleLocalProfileSave();const first=t.saveLocalProfile();
    t.player().coins=222;t.scheduleLocalProfileSave();const second=t.saveLocalProfile();
    await Promise.all([first,second]);
    assert.equal(JSON.parse(records.get('sharkRngProfile')).coins,222);
    assert.equal(h.nodes['rng-save-local'].textContent,'Saved on device');
    h.quota(false);t.player().coins=333;assert.equal(t.saveLocalProfile(),true);
    h=harness(path,records,local);t=h.api;await t.loadDeviceProfile();assert.equal(t.player().coins,333);
    t.mockUi();t.applyRngProfileData({...t.player(),coins:444});
    await new Promise(setImmediate);assert.equal(JSON.parse(records.get('sharkRngProfile')).coins,444);
    h.db.fail(true);assert.equal(await t.saveLocalProfile(),false);assert.equal(h.nodes['rng-save-local'].textContent,'Device save failed');assert.equal(t.player().coins,444);
    h.db.fail(false);assert.equal(await t.saveLocalProfile(),true);assert.equal(h.nodes['rng-save-local'].textContent,'Saved on device');
    console.log(path+': PASS quota fallback and commit status, 1.98T record/potions/reload, queued write order, newer normal save beats old fallback, cloud apply with quota full, both stores failing and retry');
}
})().catch(error=>{console.error(error);process.exitCode=1;});
