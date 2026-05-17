"use strict";var se=Object.create;var F=Object.defineProperty;var oe=Object.getOwnPropertyDescriptor;var ae=Object.getOwnPropertyNames;var ce=Object.getPrototypeOf,le=Object.prototype.hasOwnProperty;var de=(i,e,t)=>e in i?F(i,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):i[e]=t;var ue=(i,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of ae(e))!le.call(i,n)&&n!==t&&F(i,n,{get:()=>e[n],enumerable:!(r=oe(e,n))||r.enumerable});return i};var O=(i,e,t)=>(t=i!=null?se(ce(i)):{},ue(e||!i||!i.__esModule?F(t,"default",{value:i,enumerable:!0}):t,i));var g=(i,e,t)=>de(i,typeof e!="symbol"?e+"":e,t);const a=require("electron"),L=require("path"),pe=require("fs"),he=require("better-sqlite3"),ge=require("os"),me=require("crypto"),Z=require("child_process"),Q=require("util");function z(i){const e=Object.create(null,{[Symbol.toStringTag]:{value:"Module"}});if(i){for(const t in i)if(t!=="default"){const r=Object.getOwnPropertyDescriptor(i,t);Object.defineProperty(e,t,r.get?r:{enumerable:!0,get:()=>i[t]})}}return e.default=i,Object.freeze(e)}const f=z(L),d=z(pe),I=z(ge),M={HOTKEY_EVENT:"hotkey:event",HOTKEY_GET_ALL:"hotkey:get-all",HOTKEY_UPDATE_CONFIG:"hotkey:update-config",HOTKEY_CHECK_CONFLICT:"hotkey:check-conflict"},N=class N{constructor(){g(this,"registeredHotkeys",new Map);g(this,"config",null);g(this,"configPath");g(this,"mainWindow",null);g(this,"SLOT_KEYS",["1","2","3","4","5","6","7","8","9"]);this.configPath=f.join(process.env.APPDATA||process.env.HOME||"","wordshot","data","config","hotkeys.json")}static getInstance(){return N.instance||(N.instance=new N),N.instance}initialize(e){this.mainWindow=e,this.loadConfig(),this.registerAllHotkeys()}loadConfig(){try{if(d.existsSync(this.configPath)){const e=d.readFileSync(this.configPath,"utf-8");this.config=JSON.parse(e)}else this.config=this.getDefaultConfig()}catch(e){console.error("[HotkeyManager] Failed to load config:",e),this.config=this.getDefaultConfig()}}getDefaultConfig(){return{version:1,hotkeys:{switch_script_1:"1",switch_script_2:"2",switch_script_3:"3",switch_script_4:"4",switch_script_5:"5",switch_script_6:"6",switch_script_7:"7",switch_script_8:"8",switch_script_9:"9",preview_up:"Up",preview_down:"Down",toggle_pause:"Space",show_help:"?",hide_help:"Escape"}}}saveConfig(){try{const e=f.dirname(this.configPath);d.existsSync(e)||d.mkdirSync(e,{recursive:!0}),d.writeFileSync(this.configPath,JSON.stringify(this.config,null,2),"utf-8")}catch(e){console.error("[HotkeyManager] Failed to save config:",e)}}registerAllHotkeys(){var o,c,l,w,y,m;this.config||this.loadConfig();for(let p=1;p<=9;p++){const u=`switch_script_${p}`,S=((o=this.config)==null?void 0:o.hotkeys[u])||String(p);this.registerHotkey(S,()=>this.handleSwitchScript(p))}const e=((c=this.config)==null?void 0:c.hotkeys.preview_up)||"Up",t=((l=this.config)==null?void 0:l.hotkeys.preview_down)||"Down";this.registerHotkey(e,()=>this.handlePreviewScript("up")),this.registerHotkey(t,()=>this.handlePreviewScript("down"));const r=((w=this.config)==null?void 0:w.hotkeys.toggle_pause)||"Space";this.registerHotkey(r,()=>this.handleTogglePause());const n=((y=this.config)==null?void 0:y.hotkeys.show_help)||"?";this.registerHotkey(n,()=>this.handleShowHelp());const s=((m=this.config)==null?void 0:m.hotkeys.hide_help)||"Escape";this.registerHotkey(s,()=>this.handleHideHelp()),console.log("[HotkeyManager] All hotkeys registered")}registerHotkey(e,t){if(this.registeredHotkeys.has(e))return console.log(`[HotkeyManager] Hotkey ${e} already registered, skipping`),!0;try{const r=a.globalShortcut.register(e,t);return r?(this.registeredHotkeys.set(e,{accelerator:e,callback:t}),console.log(`[HotkeyManager] Registered hotkey: ${e}`)):console.warn(`[HotkeyManager] Failed to register hotkey: ${e}`),r}catch(r){return console.error(`[HotkeyManager] Error registering hotkey ${e}:`,r),!1}}unregisterAllHotkeys(){for(const[e]of this.registeredHotkeys)this.unregisterHotkey(e);this.registeredHotkeys.clear(),console.log("[HotkeyManager] All hotkeys unregistered")}unregisterHotkey(e){try{a.globalShortcut.isRegistered(e)&&a.globalShortcut.unregister(e),this.registeredHotkeys.delete(e)}catch(t){console.error(`[HotkeyManager] Error unregistering hotkey ${e}:`,t)}}sendEvent(e){this.mainWindow&&!this.mainWindow.isDestroyed()&&this.mainWindow.webContents.send(M.HOTKEY_EVENT,e)}handleSwitchScript(e){const t=`slot_${e}`;this.sendEvent({type:"switch_script",slotId:t})}handlePreviewScript(e){this.sendEvent({type:"preview_script",direction:e})}handleTogglePause(){this.sendEvent({type:"toggle_pause"})}handleShowHelp(){this.sendEvent({type:"show_help"})}handleHideHelp(){this.sendEvent({type:"hide_help"})}updateHotkey(e,t){if(!this.config)return!1;const r=this.checkConflict(t);if(r.hasConflict)return console.warn(`[HotkeyManager] Hotkey ${t} conflicts with: ${r.conflictingKeys.join(", ")}`),!1;const n=this.config.hotkeys[e];n&&this.unregisterHotkey(n),this.config.hotkeys[e]=t;let s;if(e.startsWith("switch_script_")){const o=parseInt(e.replace("switch_script_",""),10);s=()=>this.handleSwitchScript(o)}else if(e==="preview_up")s=()=>this.handlePreviewScript("up");else if(e==="preview_down")s=()=>this.handlePreviewScript("down");else if(e==="toggle_pause")s=()=>this.handleTogglePause();else if(e==="show_help")s=()=>this.handleShowHelp();else if(e==="hide_help")s=()=>this.handleHideHelp();else return console.warn(`[HotkeyManager] Unknown action: ${e}`),!1;return this.registerHotkey(t,s),this.saveConfig(),!0}checkConflict(e){const t=[];return a.globalShortcut.isRegistered(e)&&t.push(e),this.registeredHotkeys.has(e)&&t.push(e),{hasConflict:t.length>0,conflictingKeys:t}}getConfig(){return this.config}getRegisteredHotkeys(){return new Map(this.registeredHotkeys)}isRegistered(e){return this.registeredHotkeys.has(e)}destroy(){this.unregisterAllHotkeys(),N.instance=null}};g(N,"instance",null);let _=N;function fe(){const i=_.getInstance();a.ipcMain.handle(M.HOTKEY_GET_ALL,()=>i.getConfig()),a.ipcMain.handle(M.HOTKEY_UPDATE_CONFIG,(e,t,r)=>i.updateHotkey(t,r)),a.ipcMain.handle(M.HOTKEY_CHECK_CONFLICT,(e,t)=>i.checkConflict(t)),a.ipcMain.handle("layout:save",async(e,t)=>{const r=await import("fs"),n=await import("path"),s=n.join(process.cwd(),"data","config");return r.existsSync(s)||r.mkdirSync(s,{recursive:!0}),r.writeFileSync(n.join(s,"layout.json"),JSON.stringify(t,null,2)),!0}),a.ipcMain.handle("layout:load",async()=>{const e=await import("fs"),r=(await import("path")).join(process.cwd(),"data","config","layout.json");return e.existsSync(r)?JSON.parse(e.readFileSync(r,"utf-8")):null}),console.log("[IPC] Hotkey handlers registered")}let T=null;function we(){const i=a.app.getPath("userData");return L.join(i,"data","wordshot.db")}function ee(){if(T)return T;const i=we(),e=require("fs"),t=L.dirname(i);return e.existsSync(t)||e.mkdirSync(t,{recursive:!0}),T=new he(i),T.pragma("foreign_keys = ON"),T.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      priority INTEGER NOT NULL DEFAULT 5,
      triggers TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      usageCount INTEGER NOT NULL DEFAULT 0,
      lastUsedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      theme TEXT NOT NULL,
      name TEXT NOT NULL,
      totalDurationMinutes INTEGER NOT NULL DEFAULT 60,
      patterns TEXT NOT NULL DEFAULT '[]',
      repeatCount INTEGER NOT NULL DEFAULT 1,
      freeContent TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      durationSeconds INTEGER NOT NULL DEFAULT 300,
      "order" INTEGER NOT NULL DEFAULT 0,
      transition TEXT,
      scriptIds TEXT NOT NULL DEFAULT '[]',
      customContent TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER,
      totalScriptsUsed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usage_history (
      id TEXT PRIMARY KEY,
      scriptId TEXT NOT NULL,
      usedAt INTEGER NOT NULL,
      sessionId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_scripts (
      id TEXT PRIMARY KEY,
      originalDanmu TEXT,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS scripts_fts USING fts5(content, tags, content=scripts, content_rowid=rowid);

    CREATE TRIGGER IF NOT EXISTS scripts_ai AFTER INSERT ON scripts BEGIN
      INSERT INTO scripts_fts(rowid, content, tags) VALUES (NEW.rowid, NEW.content, NEW.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS scripts_ad AFTER DELETE ON scripts BEGIN
      INSERT INTO scripts_fts(scripts_fts, rowid, content, tags) VALUES('delete', OLD.rowid, OLD.content, OLD.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS scripts_au AFTER UPDATE ON scripts BEGIN
      INSERT INTO scripts_fts(scripts_fts, rowid, content, tags) VALUES('delete', OLD.rowid, OLD.content, OLD.tags);
      INSERT INTO scripts_fts(rowid, content, tags) VALUES (NEW.rowid, NEW.content, NEW.tags);
    END;

    CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category);
    CREATE INDEX IF NOT EXISTS idx_segments_templateId ON segments(templateId);
    CREATE INDEX IF NOT EXISTS idx_usage_history_scriptId ON usage_history(scriptId);
    CREATE INDEX IF NOT EXISTS idx_usage_history_sessionId ON usage_history(sessionId);
    CREATE INDEX IF NOT EXISTS idx_pending_scripts_status ON pending_scripts(status);
  `),T.prepare("PRAGMA table_info(templates)").all().find(s=>s.name==="freeContent")||T.exec("ALTER TABLE templates ADD COLUMN freeContent TEXT NOT NULL DEFAULT ''"),T.prepare("PRAGMA table_info(segments)").all().find(s=>s.name==="customContent")||T.exec("ALTER TABLE segments ADD COLUMN customContent TEXT NOT NULL DEFAULT ''"),T}function C(){return T||ee(),T}function Ce(){return C().prepare("SELECT * FROM scripts ORDER BY createdAt DESC").all().map(U)}function ye(i){const t=C().prepare("SELECT * FROM scripts WHERE id = ?").get(i);return t?U(t):void 0}function be(i){return C().prepare(`
    INSERT INTO scripts (id, category, content, color, priority, triggers, tags, usageCount, lastUsedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(i.id,i.category,i.content,i.color||"#ffffff",i.priority||5,JSON.stringify(i.triggers||[]),JSON.stringify(i.tags||[]),i.usageCount||0,i.lastUsedAt||null,i.createdAt||Date.now(),i.updatedAt||Date.now()),i}function Se(i,e){const t=C(),r=t.prepare("SELECT * FROM scripts WHERE id = ?").get(i);if(!r)return;const n={...r,...e};return t.prepare(`
    UPDATE scripts SET category = ?, content = ?, color = ?, priority = ?, triggers = ?, tags = ?, usageCount = ?, lastUsedAt = ?, updatedAt = ?
    WHERE id = ?
  `).run(n.category,n.content,n.color,n.priority,JSON.stringify(n.triggers||[]),JSON.stringify(n.tags||[]),n.usageCount,n.lastUsedAt,Date.now(),i),U(n)}function Ee(i){return C().prepare("DELETE FROM scripts WHERE id = ?").run(i).changes>0}function Te(i){return C().prepare(`
    SELECT scripts.* FROM scripts
    JOIN scripts_fts ON scripts.rowid = scripts_fts.rowid
    WHERE scripts_fts MATCH ?
    ORDER BY rank
  `).all(i).map(U)}function U(i){const e=t=>{if(t==null||t==="")return[];try{return JSON.parse(t)}catch{return[]}};return{...i,triggers:e(i.triggers),tags:e(i.tags)}}function Ie(){const i=C();return i.prepare("SELECT * FROM templates ORDER BY createdAt DESC").all().map(t=>{const r=i.prepare('SELECT * FROM segments WHERE templateId = ? ORDER BY "order" ASC').all(t.id);return{...t,freeContent:t.freeContent||"",segments:r.map(n=>({...n,scriptIds:n.scriptIds?JSON.parse(n.scriptIds):[],customContent:n.customContent||""}))}})}function De(i){const e=C(),t=e.prepare("SELECT * FROM templates WHERE id = ?").get(i);if(!t)return;const r=e.prepare('SELECT * FROM segments WHERE templateId = ? ORDER BY "order" ASC').all(i);return{...t,freeContent:t.freeContent||"",segments:r.map(n=>({...n,scriptIds:n.scriptIds?JSON.parse(n.scriptIds):[],customContent:n.customContent||""}))}}function Oe(i){return C().prepare(`
    INSERT INTO templates (id, theme, name, totalDurationMinutes, patterns, repeatCount, freeContent, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(i.id,i.theme,i.name,i.totalDurationMinutes||60,JSON.stringify(i.patterns||[]),i.repeatCount||1,i.freeContent||"",i.createdAt||Date.now(),i.updatedAt||Date.now()),i}function Re(i,e){const t=C(),r=t.prepare("SELECT * FROM templates WHERE id = ?").get(i);if(!r)return;const n={...r,...e};return t.prepare(`
    UPDATE templates SET theme = ?, name = ?, totalDurationMinutes = ?, patterns = ?, repeatCount = ?, freeContent = ?, updatedAt = ?
    WHERE id = ?
  `).run(n.theme,n.name,n.totalDurationMinutes,JSON.stringify(n.patterns||[]),n.repeatCount||1,n.freeContent||"",Date.now(),i),n}function Pe(i){console.log("[DatabaseService] deleteTemplate called with id:",i);const e=C();e.prepare("DELETE FROM segments WHERE templateId = ?").run(i);const t=e.prepare("DELETE FROM templates WHERE id = ?").run(i);return console.log("[DatabaseService] deleteTemplate result:",t.changes>0),t.changes>0}function Ne(i){return C().prepare('SELECT * FROM segments WHERE templateId = ? ORDER BY "order" ASC').all(i)}function We(i){return C().prepare(`
    INSERT INTO segments (id, templateId, name, category, durationSeconds, "order", transition, scriptIds, customContent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(i.id,i.templateId,i.name,i.category,i.durationSeconds||300,i.order||0,i.transition||null,JSON.stringify(i.scriptIds||[]),i.customContent||""),i}function Ae(i,e){const t=C(),r=t.prepare("SELECT * FROM segments WHERE id = ?").get(i);if(!r)return;const n={...r,...e};return t.prepare(`
    UPDATE segments SET name = ?, category = ?, durationSeconds = ?, "order" = ?, transition = ?, scriptIds = ?, customContent = ?
    WHERE id = ?
  `).run(n.name,n.category,n.durationSeconds,n.order,n.transition||null,JSON.stringify(n.scriptIds||[]),n.customContent||"",i),n}function Le(i){return C().prepare("DELETE FROM segments WHERE id = ?").run(i).changes>0}function _e(){return{success:!0,deletedCount:C().prepare("DELETE FROM scripts").run().changes}}function ve(){console.log("[IPC] registerDatabaseHandlers called"),a.ipcMain.handle("db:getAllScripts",()=>Ce()),a.ipcMain.handle("db:getScriptById",(i,e)=>ye(e)),a.ipcMain.handle("db:createScript",(i,e)=>be(e)),a.ipcMain.handle("db:updateScript",(i,e,t)=>Se(e,t)),a.ipcMain.handle("db:deleteScript",(i,e)=>Ee(e)),a.ipcMain.handle("db:searchScripts",(i,e)=>Te(e)),a.ipcMain.handle("db:getAllTemplates",()=>Ie()),a.ipcMain.handle("db:getTemplateById",(i,e)=>De(e)),a.ipcMain.handle("db:createTemplate",(i,e)=>Oe(e)),a.ipcMain.handle("db:updateTemplate",(i,e,t)=>Re(e,t)),a.ipcMain.handle("db:deleteTemplate",(i,e)=>(console.log("[IPC] db:deleteTemplate called with id:",e),Pe(e))),a.ipcMain.handle("db:getSegmentsByTemplate",(i,e)=>Ne(e)),a.ipcMain.handle("db:createSegment",(i,e)=>We(e)),a.ipcMain.handle("db:updateSegment",(i,e,t)=>Ae(e,t)),a.ipcMain.handle("db:deleteSegment",(i,e)=>Le(e)),a.ipcMain.handle("ai:testConnection",async(i,e)=>{console.log("[IPC] ai:testConnection called with provider:",e.baseURL);const t={"Content-Type":"application/json","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"};e.apiKey&&(t.Authorization=`Bearer ${e.apiKey}`);const r=new AbortController,n=setTimeout(()=>r.abort(),e.timeout);try{const s=await fetch(`${e.baseURL}/models`,{method:"GET",headers:t,signal:r.signal});if(clearTimeout(n),s.ok)return{success:!0,message:"连接成功"};if(s.status===401||s.status===403){const o=await fetch(`${e.baseURL}/chat/completions`,{method:"POST",headers:{...t,"Content-Type":"application/json"},body:JSON.stringify({model:e.model,messages:[{role:"user",content:"test"}],max_tokens:5}),signal:r.signal});if(clearTimeout(n),o.ok)return{success:!0,message:"连接成功"};{const c=await o.text();return{success:!1,message:`连接失败: ${o.status} ${o.statusText} - ${c.slice(0,100)}`}}}return{success:!1,message:`连接失败: ${s.status} ${s.statusText}`}}catch(s){clearTimeout(n);const o=s instanceof Error?s.message:String(s);return o.includes("aborted")?{success:!1,message:`连接超时 (${e.timeout/1e3}s)`}:{success:!1,message:`连接失败: ${o}`}}}),a.ipcMain.handle("db:clearAllScripts",()=>(console.log("[IPC] Clearing all scripts from database"),_e())),console.log("[IPC] ai:testConnection handler registered"),a.ipcMain.handle("ai:chatCompletion",async(i,e)=>{var y;console.log("[IPC] ai:chatCompletion called"),console.log("[IPC] Provider:",JSON.stringify({...e.provider,apiKey:e.provider.apiKey?"***"+e.provider.apiKey.slice(-4):void 0}));const{provider:t,messages:r,temperature:n=.7,max_tokens:s=128e3}=e,o=Math.max(t.timeout,6e5),c={"Content-Type":"application/json","User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"};t.apiKey&&(c.Authorization=`Bearer ${t.apiKey}`);const l=new AbortController,w=setTimeout(()=>l.abort(),o);try{const m=`${t.baseURL}/chat/completions`;console.log("[IPC] Fetching from:",m);const p=await fetch(m,{method:"POST",headers:c,body:JSON.stringify({model:t.model,messages:r,temperature:n,max_tokens:s}),signal:l.signal});if(clearTimeout(w),!p.ok){const S=await p.text();return console.log("[IPC] Response error:",p.status,S.slice(0,300)),{success:!1,error:`HTTP ${p.status}: ${p.statusText} - ${S.slice(0,200)}`}}const u=await p.json();return console.log("[IPC] Chat response data:",JSON.stringify(u).slice(0,500)),u.choices&&u.choices[0]?{success:!0,content:((y=u.choices[0].message)==null?void 0:y.content)||"",usage:u.usage}:u.text||u.result?{success:!0,content:u.text||u.result,usage:u.usage}:typeof u=="string"?{success:!0,content:u,usage:void 0}:{success:!1,error:"Invalid response format from AI provider"}}catch(m){clearTimeout(w);const p=m instanceof Error?m.message:String(m),u=m instanceof Error?m.stack:"";return console.error("[IPC] Chat completion error:",p,u),p.includes("aborted")?{success:!1,error:`连接超时 (${o/1e3}s)`}:{success:!1,error:`连接失败: ${p}`}}}),a.ipcMain.handle("ai:getProviders",async()=>{try{const i=await import("fs"),t=(await import("path")).join(process.cwd(),"data","config","ai_providers.json");if(i.existsSync(t)){const r=i.readFileSync(t,"utf-8");return JSON.parse(r)}}catch(i){console.error("[IPC] Error reading AI providers:",i)}return{providers:[]}}),a.ipcMain.handle("ai:getOcrProvider",async()=>{var i,e;try{const t=await import("fs"),n=(await import("path")).join(process.cwd(),"data","config","ai_providers.json");if(console.log("[IPC] Looking for AI config at:",n),t.existsSync(n)){const s=t.readFileSync(n,"utf-8"),o=JSON.parse(s);console.log("[IPC] AI config from file:",JSON.stringify(o).slice(0,200));const c=(i=o.providers)==null?void 0:i.find(l=>l.enabled);if(c)return{baseURL:c.baseURL,apiKey:c.apiKey||void 0,model:c.model,timeout:c.timeout||12e4}}else{console.log("[IPC] AI config file not found, trying localStorage via renderer...");const s=(e=a.BrowserWindow.getAllWindows()[0])==null?void 0:e.webContents;if(s){const o=await s.executeJavaScript(`
            new Promise((resolve) => {
              const item = localStorage.getItem('wordshot_config_ai_providers.json');
              if (item) {
                try {
                  const config = JSON.parse(item);
                  const enabled = config.providers?.find(p => p.enabled);
                  if (enabled) {
                    resolve({
                      baseURL: enabled.baseURL,
                      apiKey: enabled.apiKey || undefined,
                      model: enabled.model,
                      timeout: enabled.timeout || 120000,
                    });
                  } else {
                    resolve(null);
                  }
                } catch (e) {
                  console.error('Parse error:', e);
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            })
          `);if(o)return console.log("[IPC] AI config from localStorage:",JSON.stringify(o).slice(0,200)),o}}}catch(t){console.error("[IPC] Error getting OCR provider:",t)}return null}),console.log("[IPC] Database handlers registered")}const te=Q.promisify(Z.exec);let ne=!1,x="none";async function ie(){await re()?(x="windows",console.log("[OCR] Using Windows.Media.Ocr.CLI backend")):(x="none",console.log("[OCR] No local OCR available, cloud OCR required")),ne=!0}async function re(){const i=[f.join(I.homedir(),"AppData","Local","Microsoft","WindowsApps","Windows.Media.Ocr.Cli.exe"),"C:\\Program Files (x86)\\Windows.Media.Ocr.Cli.exe","C:\\Program Files\\Windows.Media.Ocr.Cli.exe"];for(const e of i)if(d.existsSync(e))return e;try{const{stdout:e}=await te("where Windows.Media.Ocr.Cli",{encoding:"utf8"});if(e.trim())return e.trim().split(`
`)[0]}catch{}return null}async function $e(i,e){var r,n;const t=Date.now();console.log("[OCR] Performing cloud OCR...");try{const s={"Content-Type":"application/json"};e.apiKey&&(s.Authorization=`Bearer ${e.apiKey}`);const o=`${e.baseURL}/chat/completions`,c=Date.now();console.log("[OCR] Calling AI provider at:",o);const l=new AbortController,w=setTimeout(()=>l.abort(),e.timeout||12e4),y=await fetch(o,{method:"POST",headers:s,body:JSON.stringify({model:e.model,messages:[{role:"system",content:"你是一个弹幕/聊天记录提取引擎。只输出从图像中识别出的用户消息和弹幕内容，每行一条。输出格式：如果有用户名，格式为“用户名: 内容”；如果没有用户名，只输出内容。绝对不要输出任何解释、描述、界面元素（如按钮、窗口标题、时间戳、操作指令）或额外标记。"},{role:"user",content:[{type:"text",text:"提取这张截图中的所有弹幕和聊天消息，忽略界面上的其他文字。"},{type:"image_url",image_url:{url:`data:image/png;base64,${i}`}}]}],temperature:0,max_tokens:500}),signal:l.signal});clearTimeout(w);const m=Date.now()-c,p=await y.text();try{const b=require("fs"),h=require("os"),D=f.join(h.homedir(),"Documents","wordshot_debug");b.existsSync(D)||b.mkdirSync(D,{recursive:!0});const v=f.join(D,`ocr_raw_${Date.now()}.txt`);b.writeFileSync(v,p),console.log("[OCR] Raw response saved to:",v)}catch(b){console.log("[OCR] Failed to save raw response:",b)}let u;try{u=JSON.parse(p)}catch(b){return console.error("[OCR] Failed to parse JSON response:",b),{text:"",confidence:0}}const S=Date.now()-c;if(console.log("[OCR] Cloud OCR response parsed in",S,"ms"),u.choices&&((n=(r=u.choices[0])==null?void 0:r.message)!=null&&n.content)){const b=Date.now()-t;console.log(`[OCR] Cloud OCR total time: ${b}ms`);const h=u.choices[0].message.content.trim();return console.log("[OCR] Danmu content:",JSON.stringify(h.slice(0,300))),{text:h,confidence:.9}}return{text:"",confidence:0}}catch(s){const o=Date.now()-t;return console.error(`[OCR] Cloud OCR error after ${o}ms:`,s),{text:"",confidence:0}}}async function k(i,e){ne||await ie(),console.log("[OCR] Starting OCR, backend:",x);try{const t=f.join(I.tmpdir(),`ocr_input_${Date.now()}.png`),r=f.join(I.tmpdir(),`ocr_input_${Date.now()}.bmp`);Buffer.isBuffer(i)?d.writeFileSync(t,i):typeof i=="string"?d.writeFileSync(t,Buffer.from(i,"base64")):d.writeFileSync(t,Buffer.from(i));const n=d.readFileSync(t);if(n[0]===66&&n[1]===77){d.writeFileSync(r,n);try{const{execSync:s}=require("child_process"),o=f.join(I.tmpdir(),`convert_${Date.now()}.ps1`),c=`
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('${r.replace(/\\/g,"\\\\")}')
$bmp.Save('${t.replace(/\\/g,"\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;d.writeFileSync(o,Buffer.concat([Buffer.from([239,187,191]),Buffer.from(c,"utf8")])),s(`powershell -NoProfile -ExecutionPolicy Bypass -File "${o}"`,{encoding:"utf8",timeout:15e3});try{d.unlinkSync(o)}catch{}try{d.unlinkSync(r)}catch{}}catch(s){console.log("[OCR] BMP to PNG conversion failed:",s)}}if(console.log("[OCR] Image saved to:",t),x==="windows"){const s=await re();if(s&&d.existsSync(s)){console.log("[OCR] Using Windows OCR CLI at:",s);const{stdout:o,stderr:c}=await te(`"${s}" -l zh-Hans-CN "${t}"`,{maxBuffer:10*1024*1024,encoding:"utf8"});if(console.log("[OCR] CLI stdout:",o==null?void 0:o.slice(0,500)),console.log("[OCR] CLI stderr:",c==null?void 0:c.slice(0,200)),o&&o.trim())return d.unlinkSync(t),{text:o.trim(),confidence:.85}}}if(e){const s=d.readFileSync(t),o=s.toString("base64"),c=s[0]===137&&s[1]===80&&s[2]===78&&s[3]===71;console.log("[OCR] Image format check - PNG:",c,"size:",s.length);const l=await $e(o,e);if(l.text)return d.unlinkSync(t),l}return d.unlinkSync(t),{text:"",confidence:0}}catch(t){return console.error("[OCR] OCR error:",t),{text:"",confidence:0}}}function G(i){const e=[];console.log("[OCR] parseOCRDanmu called with:",JSON.stringify(i.slice(0,200)));const t=i.split(`
`);for(const r of t){const n=r.trim();if(!n||n.length<2)continue;const s=n.indexOf(":");if(s>0&&s<n.length-1){const o=n.substring(0,s),c=n.substring(s+1).trim();/^[a-zA-Z一-龥][a-zA-Z0-9一-龥_\s]*$/.test(o)&&c.length>0&&e.push({username:o.trim(),content:c.trim(),type:"normal",raw:n})}else e.push({username:"",content:n,type:"normal",raw:n})}return console.log("[OCR] parseOCRDanmu results:",e.length,"items"),e}function j(i,e){const t=i.toLowerCase();return e.toLowerCase(),t.includes("火箭")||t.includes("飞船")||t.includes("超级火箭")||/\d{3,}[元¥]/.test(t)?"big_gift":t.includes("礼物")||t.includes("打赏")||t.includes("送")||t.includes("赞")?"gift":t.includes("关注")||t.includes("follow")||t.includes("粉丝")?"follower":t.includes("?")||t.includes("？")||t.includes("怎么")||t.includes("如何")||t.includes("为什么")?"question":t.includes("滚")||t.includes("垃圾")||t.includes("恶心")||t.includes("差评")?"hater":t.includes("不服")||t.includes("来啊")||t.includes("挑战")?"provocative":t.includes("贵宾")||t.includes("VIP")||t.includes("老爷")?"vip":t.includes("好看")||t.includes("漂亮")||t.includes("棒")||t.includes("赞")||t.includes("厉害")?"praise":t.includes("PK")||t.includes("pk")||t.includes("挑战")?"pk":"normal"}function K(i){return!(i.length<2||i.length>500||i.replace(/[^a-zA-Z一-龥]/g,"").length<2)}const $=Q.promisify(Z.exec),W=class W{constructor(){}static getInstance(){return W.instance||(W.instance=new W),W.instance}async getDesktopCapturerWindows(){try{return(await a.desktopCapturer.getSources({types:["window"],thumbnailSize:{width:150,height:150}})).map(t=>({hwnd:t.id,title:t.name,className:"",processName:t.name,rect:{x:0,y:0,width:0,height:0},isVisible:!0,parentHwnd:null,level:0}))}catch(e){return console.error("[WindowsWindowEnumerator] desktopCapturer error:",e),[]}}async getAllWindows(){try{const e=f.join(I.tmpdir(),`ws_enum_${Date.now()}.ps1`),t=`
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class WindowEnumerator {
  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  public static List<IntPtr> GetChildWindows(IntPtr parent) {
    List<IntPtr> result = new List<IntPtr>();
    IntPtr child = GetWindow(parent, 5);
    while (child != IntPtr.Zero) {
      result.Add(child);
      child = GetWindow(child, 2);
    }
    return result;
  }
}
"@

$windows = @()
$visited = @{}

function Get-WindowInfo {
  param([IntPtr]$hwnd, [int]$level, [IntPtr]$parentHwnd)

  if ($visited.ContainsKey($hwnd.ToString())) { return }
  $visited[$hwnd.ToString()] = $true

  $titleBuilder = New-Object System.Text.StringBuilder 256
  $classBuilder = New-Object System.Text.StringBuilder 256
  [WindowEnumerator]::GetWindowText($hwnd, $titleBuilder, 256) | Out-Null
  [WindowEnumerator]::GetClassName($hwnd, $classBuilder, 256) | Out-Null

  $title = $titleBuilder.ToString()
  $className = $classBuilder.ToString()

  if ([string]::IsNullOrEmpty($title) -and $level -gt 0) { return }

  $rect = New-Object WindowEnumerator+RECT
  [WindowEnumerator]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top

  $processId = 0
  [WindowEnumerator]::GetWindowThreadProcessId($hwnd, [ref]$processId) | Out-Null

  $isVisible = [WindowEnumerator]::IsWindowVisible($hwnd)

  $processName = ""
  if ($processId -gt 0) {
    try {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($process) { $processName = $process.ProcessName }
    } catch {}
  }

  $script:windows += @{
    hwnd = $hwnd.ToString()
    title = $title
    className = $className
    processName = $processName
    rect = @{
      x = $rect.Left
      y = $rect.Top
      width = $width
      height = $height
    }
    isVisible = $isVisible
    parentHwnd = if ($parentHwnd -eq [IntPtr]::Zero) { $null } else { $parentHwnd.ToString() }
    level = $level
  }

  $children = [WindowEnumerator]::GetChildWindows($hwnd)
  foreach ($child in $children) {
    Get-WindowInfo -hwnd $child -level ($level + 1) -parentHwnd $hwnd
  }
}

[WindowEnumerator]::EnumWindows({
  param([IntPtr]$hwnd, [IntPtr]$lParam)
  Get-WindowInfo -hwnd $hwnd -level 0 -parentHwnd ([IntPtr]::Zero)
  return $true
}, [IntPtr]::Zero) | Out-Null

$windows | ConvertTo-Json -Depth 10
`,r=Buffer.from([239,187,191]),n=Buffer.concat([r,Buffer.from(t,"utf8")]);d.writeFileSync(e,n);try{const{stdout:s}=await $(`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; & '${e}'"`,{maxBuffer:10485760,encoding:"utf8"});if(console.log("[WindowsWindowEnumerator] PowerShell stdout length:",s==null?void 0:s.length),console.log("[WindowsWindowEnumerator] PowerShell stdout preview:",s==null?void 0:s.slice(0,200)),!s||s.trim()===""||s.trim()==="null")return console.log("[WindowsWindowEnumerator] Empty stdout"),[];const o=JSON.parse(s.trim());return(Array.isArray(o)?o:[o]).map(l=>({hwnd:l.hwnd,title:l.title||"",className:l.className||"",processName:l.processName||"",rect:l.rect||{x:0,y:0,width:0,height:0},isVisible:l.isVisible??!0,parentHwnd:l.parentHwnd||null,level:l.level||0}))}finally{try{d.unlinkSync(e)}catch{}}}catch(e){return console.error("[WindowsWindowEnumerator] Error getting all windows:",e),[]}}async findWindowsByProcess(e){return(await this.getAllWindows()).filter(n=>n.processName.toLowerCase().includes(e.toLowerCase()))}async findChildWindows(e){return(await this.getAllWindows()).filter(r=>r.parentHwnd===e)}async findWindowsByTitle(e){const t=await this.getAllWindows(),r=e.toLowerCase();return t.filter(n=>n.title.toLowerCase().includes(r))}async findHudongWindow(){const e=await this.getAllWindows();console.log("[findHudongWindow] Total windows:",e.length);const t=e.filter(o=>o.isVisible&&o.level>0);console.log("[findHudongWindow] Visible child windows:",t.length),t.forEach((o,c)=>{console.log(`  [${c}] title="${o.title}" process="${o.processName}" hwnd=${o.hwnd} level=${o.level}`)});let r=e.find(o=>o.title==="互动消息区"&&o.isVisible&&o.level>0);if(r)return console.log("[findHudongWindow] Found exact match:",r.title),r;if(r=e.find(o=>o.title.includes("互动消息区")&&o.isVisible),r)return console.log("[findHudongWindow] Found contains match:",r.title),r;const n=e.filter(o=>o.processName.includes("直播伴侣")&&o.level>0&&o.isVisible&&o.title.length>0);if(console.log("[findHudongWindow] Douyin child windows with title:",n.length),n.length>0){const o=n.find(c=>c.title.length>2);if(o)return console.log("[findHudongWindow] Returning first douyin child with title:",o.title),o}const s=t.find(o=>o.title.length>2);return s?(console.log("[findHudongWindow] Returning first visible child with title:",s.title),s):(console.log("[findHudongWindow] No suitable window found"),null)}async findDouyinLiveWindows(){const e=await this.getAllWindows(),t=e.find(s=>s.title.toLowerCase().includes("直播伴侣")&&s.level===0&&s.isVisible);if(!t)return{mainWindow:null,childWindows:[]};const r=e.filter(s=>s.parentHwnd===t.hwnd||s.hwnd===t.hwnd),n=this.findAllDescendants(t.hwnd,e);return{mainWindow:t,childWindows:[...r,...n]}}findAllDescendants(e,t){const r=t.filter(s=>s.parentHwnd===e),n=[...r];for(const s of r){const o=this.findAllDescendants(s.hwnd,t);n.push(...o)}return n}async getWindowDetails(e){return(await this.getAllWindows()).find(r=>r.hwnd===e)||null}async captureWindow(e){try{const t=f.join(I.tmpdir(),`ws_cap_${Date.now()}.ps1`),r=`
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class ScreenCapture {
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern IntPtr GetDC(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

  [DllImport("gdi32.dll")]
  public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

  [DllImport("gdi32.dll")]
  public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

  [DllImport("gdi32.dll")]
  public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

  [DllImport("gdi32.dll")]
  public static extern bool DeleteDC(IntPtr hdc);

  [DllImport("gdi32.dll")]
  public static extern bool DeleteObject(IntPtr hObject);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public static Image CaptureWindow(IntPtr hwnd) {
    RECT rect;
    GetWindowRect(hwnd, out rect);
    int width = rect.Right - rect.Left;
    int height = rect.Bottom - rect.Top;

    IntPtr hdcScreen = GetDC(IntPtr.Zero);
    IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
    IntPtr hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
    IntPtr hOld = SelectObject(hdcMem, hBitmap);

    BitBlt(hdcMem, 0, 0, width, height, hdcScreen, rect.Left, rect.Top, 0x00CC0020);

    SelectObject(hdcMem, hOld);
    Image img = new Bitmap(hBitmap);

    DeleteObject(hBitmap);
    DeleteDC(hdcMem);
    ReleaseDC(IntPtr.Zero, hdcScreen);

    return img;
  }
}
"@

$hwnd = [IntPtr]::new(${e})
$img = [ScreenCapture]::CaptureWindow($hwnd)
$ms = New-Object System.IO.MemoryStream
$img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[Convert]::ToBase64String($ms.ToArray())
`,n=Buffer.from([239,187,191]),s=Buffer.concat([n,Buffer.from(r,"utf8")]);d.writeFileSync(t,s);try{const{stdout:o}=await $(`powershell -NoProfile -ExecutionPolicy Bypass -File "${t}"`,{maxBuffer:52428800});return!o||o.trim()===""?null:Buffer.from(o.trim(),"base64")}finally{try{d.unlinkSync(t)}catch{}}}catch(t){return console.error("[WindowsWindowEnumerator] Error capturing window:",t),null}}async captureRegion(e){try{console.log("[captureRegion] Starting capture, region:",JSON.stringify(e));const t=f.join(I.tmpdir(),`ws_reg_${Date.now()}.ps1`),r=f.join(I.tmpdir(),`ws_cap_${Date.now()}.png`),n=`
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.IO;
using System.Drawing;

public class ScreenCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    public static extern int GetDIBits(IntPtr hdc, IntPtr hbmp, uint uStartScan, uint cScanLines, byte[] lpvBits, ref BITMAPINFO lpbi, uint uUsage);

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER {
        public uint biSize;
        public int biWidth;
        public int biHeight;
        public ushort biPlanes;
        public ushort biBitCount;
        public uint biCompression;
        public uint biSizeImage;
        public int biXPelsPerMeter;
        public int biYPelsPerMeter;
        public uint biClrUsed;
        public uint biClrImportant;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFO {
        public BITMAPINFOHEADER bmiHeader;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1)]
        public uint[] bmiColors;
    }

    public static void Capture(int x, int y, int width, int height, string filePath) {
        IntPtr hdcScreen = GetDC(IntPtr.Zero);
        IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
        IntPtr hOld = SelectObject(hdcMem, hBitmap);

        BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, 0x00CC0020);

        SelectObject(hdcMem, hOld);

        var bmi = new BITMAPINFO();
        bmi.bmiHeader.biSize = 40;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0;

        var pixels = new byte[width * height * 4];
        GetDIBits(hdcMem, hBitmap, 0, (uint)height, pixels, ref bmi, 0);

        using (var fs = new FileStream(filePath, FileMode.Create)) {
            var bw = new BinaryWriter(fs);
            bw.Write((ushort)0x4D42);
            bw.Write(54 + pixels.Length);
            bw.Write(0);
            bw.Write(54);
            bw.Write(40);
            bw.Write(width);
            bw.Write(-height);
            bw.Write((short)1);
            bw.Write((short)32);
            bw.Write(0);
            bw.Write(pixels.Length);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(pixels);
        }

        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(IntPtr.Zero, hdcScreen);
    }
}
"@

$x = ${e.x}
$y = ${e.y}
$w = ${e.width}
$h = ${e.height}
$outPath = "${r.replace(/\\/g,"\\\\")}"
[ScreenCapture]::Capture($x, $y, $w, $h, $outPath)
Write-Output "OK"
`,s=Buffer.from([239,187,191]),o=Buffer.concat([s,Buffer.from(n,"utf8")]);d.writeFileSync(t,o,{encoding:"utf8"});try{console.log("[captureRegion] Executing PowerShell script");const{stdout:c,stderr:l}=await $(`powershell -NoProfile -ExecutionPolicy Bypass -File "${t}"`,{maxBuffer:10*1024*1024,encoding:"utf8"});if(console.log("[captureRegion] PowerShell stdout:",c),console.log("[captureRegion] PowerShell stderr:",l==null?void 0:l.slice(0,200)),!c.includes("OK"))return console.log("[captureRegion] Script did not complete successfully"),null;if(!d.existsSync(r))return console.log("[captureRegion] Output file not found:",r),null;const w=d.readFileSync(r);console.log("[captureRegion] Captured buffer size:",w.length);try{d.unlinkSync(r)}catch{}return w}finally{try{d.unlinkSync(t)}catch{}}}catch(t){return console.error("[WindowsWindowEnumerator] Error capturing region:",t),null}}async performOCROnRegion(e){try{console.log("[WindowsOCR] Starting OCR on region");const t=f.join(I.tmpdir(),`ocr_screenshot_${Date.now()}.png`),r=f.join(I.tmpdir(),`ocr_capture_${Date.now()}.ps1`),n=`
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class CaptureHelper {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    public static extern int GetDIBits(IntPtr hdc, IntPtr hbmp, uint uStartScan, uint cScanLines, byte[] lpvBits, ref BITMAPINFO lpbi, uint uUsage);

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER {
        public uint biSize;
        public int biWidth;
        public int biHeight;
        public ushort biPlanes;
        public ushort biBitCount;
        public uint biCompression;
        public uint biSizeImage;
        public int biXPelsPerMeter;
        public int biYPelsPerMeter;
        public uint biClrUsed;
        public uint biClrImportant;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFO {
        public BITMAPINFOHEADER bmiHeader;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 1)]
        public uint[] bmiColors;
    }

    public static void Capture(int x, int y, int width, int height, string filePath) {
        IntPtr hdcScreen = GetDC(IntPtr.Zero);
        IntPtr hdcMem = CreateCompatibleDC(hdcScreen);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcScreen, width, height);
        IntPtr hOld = SelectObject(hdcMem, hBitmap);

        BitBlt(hdcMem, 0, 0, width, height, hdcScreen, x, y, 0x00CC0020);

        SelectObject(hdcMem, hOld);

        var bmi = new BITMAPINFO();
        bmi.bmiHeader.biSize = 40;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0;

        var pixels = new byte[width * height * 4];
        GetDIBits(hdcMem, hBitmap, 0, (uint)height, pixels, ref bmi, 0);

        using (var fs = new FileStream(filePath, FileMode.Create)) {
            var bw = new BinaryWriter(fs);
            bw.Write((ushort)0x4D42);
            bw.Write(54 + pixels.Length);
            bw.Write(0);
            bw.Write(54);
            bw.Write(40);
            bw.Write(width);
            bw.Write(-height);
            bw.Write((short)1);
            bw.Write((short)32);
            bw.Write(0);
            bw.Write(pixels.Length);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(0);
            bw.Write(pixels);
        }

        DeleteObject(hBitmap);
        DeleteDC(hdcMem);
        ReleaseDC(IntPtr.Zero, hdcScreen);
    }
}
"@

[CaptureHelper]::Capture(${e.x}, ${e.y}, ${e.width}, ${e.height}, "${t.replace(/\\/g,"\\\\")}")
Write-Output "CAPTURED:${t}"
`,s=Buffer.from([239,187,191]),o=Buffer.concat([s,Buffer.from(n,"utf8")]);d.writeFileSync(r,o,{encoding:"utf8"});try{const{stdout:c}=await $(`powershell -NoProfile -ExecutionPolicy Bypass -File "${r}"`,{maxBuffer:10485760,encoding:"utf8"});return c.includes("CAPTURED:")?(console.log("[WindowsOCR] Screenshot captured"),{text:"OCR functionality temporarily unavailable",confidence:0}):(console.log("[WindowsOCR] Capture failed"),null)}finally{try{d.unlinkSync(r)}catch{}try{d.unlinkSync(t)}catch{}}}catch(t){return console.error("[WindowsOCR] Error:",t),null}}};g(W,"instance",null);let P=W;const E={CAPTURE_START:"danmu:capture-start",CAPTURE_STOP:"danmu:capture-stop",CAPTURE_PAUSE:"danmu:capture-pause",CAPTURE_RESUME:"danmu:capture-resume",GET_WINDOWS:"danmu:get-windows",SELECT_WINDOW:"danmu:select-window",UPDATE_CONFIG:"danmu:update-config",GET_CONFIG:"danmu:get-config",DANMU_NEW:"danmu:new",DANMU_BATCH:"danmu:batch",CAPTURE_ERROR:"danmu:error",CAPTURE_STATUS:"danmu:status"},B=f.join(process.cwd(),"data","config"),X=f.join(B,"danmu_capture.json"),V=f.join(B,"ai_providers.json");function J(){d.existsSync(B)||d.mkdirSync(B,{recursive:!0})}const Y={enabled:!1,windowTitle:"",captureIntervalMs:2e3,useOCR:!1,ocrEngine:"tesseract"},A=class A{constructor(){g(this,"config");g(this,"selectedWindow",null);g(this,"captureTimer",null);g(this,"isCapturing",!1);g(this,"isPaused",!1);g(this,"ocrInitialized",!1);g(this,"dedupTimeWindowMs",30*60*1e3);g(this,"dedupSimilarityThreshold",.85);g(this,"dedupState",{seenDanmu:new Map,recentContents:[]});g(this,"mainWindow",null);g(this,"captureRegionRect",null);this.config=this.loadConfig(),J()}static getInstance(){return A.instance||(A.instance=new A),A.instance}initialize(e){this.mainWindow=e,this.registerIpcHandlers(),console.log("[DanmuCapture] Service initialized")}registerIpcHandlers(){a.ipcMain.handle(E.GET_WINDOWS,async()=>this.getAvailableWindows()),a.ipcMain.handle("danmu:get-all-windows",async()=>this.getAllWindowsIncludingChildren()),a.ipcMain.handle("danmu:find-windows-by-process",async(e,t)=>this.findWindowsByProcess(t)),a.ipcMain.handle("danmu:find-windows-by-title",async(e,t)=>this.findWindowsByTitle(t)),a.ipcMain.handle("danmu:find-hudong-window",async()=>this.findHudongWindow()),a.ipcMain.handle(E.SELECT_WINDOW,async(e,t)=>this.selectWindow(t)),a.ipcMain.handle(E.UPDATE_CONFIG,async(e,t)=>this.updateConfig(t)),a.ipcMain.handle(E.GET_CONFIG,async()=>this.config),a.ipcMain.handle(E.CAPTURE_START,async()=>this.startCapture()),a.ipcMain.handle(E.CAPTURE_STOP,async()=>this.stopCapture()),a.ipcMain.handle(E.CAPTURE_PAUSE,async()=>this.pauseCapture()),a.ipcMain.handle(E.CAPTURE_RESUME,async()=>this.resumeCapture()),a.ipcMain.handle("danmu:get-capture-status",async()=>({isCapturing:this.isCapturing,isPaused:this.isPaused,status:this.isCapturing?this.isPaused?"paused":"capturing":"stopped"})),a.ipcMain.handle("danmu:capture-region",async(e,t)=>this.captureRegion(t)),a.ipcMain.handle("danmu:set-capture-region",async(e,t)=>(this.setCaptureRegion(t),!0)),a.ipcMain.handle("danmu:get-capture-region",async()=>this.getCaptureRegion()),a.ipcMain.handle("danmu:get-ocr-provider",async()=>{try{if(this.mainWindow&&!this.mainWindow.isDestroyed()){const e=await this.mainWindow.webContents.executeJavaScript(`
            (function() {
              const item = localStorage.getItem('wordshot_config_ai_providers.json');
              if (item) {
                try {
                  const config = JSON.parse(item);
                  const enabled = config.providers && config.providers.find(function(p) { return p.enabled; });
                  if (enabled) {
                    return {
                      baseURL: enabled.baseURL,
                      apiKey: enabled.apiKey || undefined,
                      model: enabled.model,
                      timeout: enabled.timeout || 120000
                    };
                  }
                } catch (e) {}
              }
              return null;
            })()
          `);if(e)return console.log("[DanmuCapture] AI provider from localStorage:",e.baseURL),e}}catch(e){console.error("[DanmuCapture] Error getting OCR provider via IPC:",e)}return null}),console.log("[DanmuCapture] IPC handlers registered")}getOcrProvider(){var e;try{if(d.existsSync(V)){const t=d.readFileSync(V,"utf-8"),n=(e=JSON.parse(t).providers)==null?void 0:e.find(s=>s.enabled);if(n)return console.log("[DanmuCapture] AI provider from file system:",n.baseURL),{baseURL:n.baseURL,apiKey:n.apiKey||void 0,model:n.model,timeout:n.timeout||12e4}}}catch(t){console.error("[DanmuCapture] Error reading AI providers:",t)}return null}loadConfig(){J();try{if(d.existsSync(X)){const e=d.readFileSync(X,"utf-8"),t=JSON.parse(e);return{...Y,...t.config}}}catch(e){console.error("[DanmuCapture] Error loading config:",e)}return{...Y}}saveConfig(){J();try{d.writeFileSync(X,JSON.stringify({config:this.config},null,2),"utf-8"),console.log("[DanmuCapture] Config saved")}catch(e){console.error("[DanmuCapture] Error saving config:",e)}}updateConfig(e){return this.config={...this.config,...e},this.saveConfig(),this.isCapturing&&e.captureIntervalMs&&(this.stopCapture(),this.startCapture()),this.config}async getAvailableWindows(){try{return(await a.desktopCapturer.getSources({types:["window"],thumbnailSize:{width:150,height:150}})).map(r=>{var n;return{id:r.id,title:r.name,processName:r.name,selected:((n=this.selectedWindow)==null?void 0:n.id)===r.id}})}catch(e){return console.error("[DanmuCapture] Error getting windows:",e),[]}}async getAllWindowsIncludingChildren(){try{return(await P.getInstance().getAllWindows()).filter(s=>s.title&&s.title.length>0).map(s=>{var o;return{id:s.hwnd,title:s.title,processName:s.processName,position:s.rect,selected:((o=this.selectedWindow)==null?void 0:o.id)===s.hwnd,isChildWindow:s.level>0,parentHwnd:s.parentHwnd}})}catch(e){return console.error("[DanmuCapture] Error getting all windows:",e),[]}}async findWindowsByProcess(e){try{return(await P.getInstance().findWindowsByProcess(e)).map(n=>{var s;return{id:n.hwnd,title:n.title,processName:n.processName,position:n.rect,selected:((s=this.selectedWindow)==null?void 0:s.id)===n.hwnd,isChildWindow:n.level>0,parentHwnd:n.parentHwnd}})}catch(t){return console.error("[DanmuCapture] Error finding windows by process:",t),[]}}async findWindowsByTitle(e){try{return(await P.getInstance().findWindowsByTitle(e)).map(n=>{var s;return{id:n.hwnd,title:n.title,processName:n.processName,position:n.rect,selected:((s=this.selectedWindow)==null?void 0:s.id)===n.hwnd,isChildWindow:n.level>0,parentHwnd:n.parentHwnd}})}catch(t){return console.error("[DanmuCapture] Error finding windows by title:",t),[]}}async findHudongWindow(){var e;try{const r=await P.getInstance().findHudongWindow();return r?{id:r.hwnd,title:r.title,processName:r.processName,position:r.rect,selected:((e=this.selectedWindow)==null?void 0:e.id)===r.hwnd,isChildWindow:r.level>0,parentHwnd:r.parentHwnd}:null}catch(t){return console.error("[DanmuCapture] Error finding hudong window:",t),null}}async captureRegion(e){var r;const t=Date.now();try{console.log(`[DanmuCapture] Capture started at ${new Date().toLocaleTimeString()}`);const n=P.getInstance(),s=Date.now(),o=await n.captureRegion(e),c=Date.now()-s;if(console.log(`[DanmuCapture] Screenshot captured in ${c}ms, size: ${(o==null?void 0:o.length)||0}`),!o)return console.log("[DanmuCapture] Failed to capture region"),[];const l=f.join(I.homedir(),"Documents","wordshot_debug"),w=Date.now(),y=f.join(l,`capture_${w}.png`);try{const h=require("fs");h.existsSync(l)||h.mkdirSync(l,{recursive:!0}),h.writeFileSync(y,o),console.log("[DanmuCapture] Screenshot saved to:",y)}catch(h){console.log("[DanmuCapture] Failed to save screenshot:",h)}let m;this.config.ocrEngine==="cloud"&&(m=await((r=this.mainWindow)==null?void 0:r.webContents.executeJavaScript(`
          (function() {
            const item = localStorage.getItem('wordshot_config_ai_providers.json');
            if (item) {
              try {
                const config = JSON.parse(item);
                const enabled = config.providers && config.providers.find(function(p) { return p.enabled; });
                if (enabled) {
                  return {
                    baseURL: enabled.baseURL,
                    apiKey: enabled.apiKey || undefined,
                    model: enabled.model,
                    timeout: enabled.timeout || 120000
                  };
                }
              } catch (e) {}
            }
            return null;
          })()
        `))??void 0,m?console.log("[DanmuCapture] Using cloud OCR with provider:",m.baseURL):console.log("[DanmuCapture] Cloud OCR selected but no AI provider configured"));let p;const u=Date.now();try{p=await k(o,m);const h=Date.now()-u;console.log(`[DanmuCapture] OCR completed in ${h}ms`),console.log(`[DanmuCapture] OCR result: ${JSON.stringify(p.text)}`)}catch(h){const D=Date.now()-u;return console.log(`[DanmuCapture] OCR failed after ${D}ms:`,h),[]}const S=G(p.text),b=[];for(const h of S){if(console.log(`[DanmuCapture] Raw danmu: username="${h.username}" content="${h.content}"`),!K(h.content)){console.log(`[DanmuCapture] Filtered out by isValidDanmuText: "${h.content}"`);continue}const D=j(h.content,h.username),v=this.createDanmu(h.username,h.content,D);b.push(v)}if(b.length>0){const h=this.deduplicateDanmu(b),D=Date.now()-t;return console.log(`[DanmuCapture] Total capture cycle completed in ${D}ms, danmu count: ${h.length}`),h}return console.log("[DanmuCapture] No valid danmu found"),[]}catch(n){const s=Date.now()-t;return console.error(`[DanmuCapture] Region capture error after ${s}ms:`,n),[]}}setCaptureRegion(e){this.captureRegionRect=e,console.log("[DanmuCapture] Capture region set:",e)}getCaptureRegion(){return this.captureRegionRect}async selectWindow(e){let t=await this.getAvailableWindows(),r=t.find(n=>n.id===e);return r||(t=await this.getAllWindowsIncludingChildren(),r=t.find(n=>n.id===e)),r&&(this.selectedWindow=r,this.config.windowTitle=r.title,this.saveConfig(),console.log(`[DanmuCapture] Window selected: ${r.title} (isChild: ${r.isChildWindow})`)),r||null}startCapture(){return this.isCapturing?(console.log("[DanmuCapture] Already capturing"),!0):!this.selectedWindow&&!this.config.windowTitle?(this.sendError("No window selected"),!1):(this.config.useOCR&&!this.ocrInitialized&&this.initOcrService(),this.isCapturing=!0,this.isPaused=!1,this.captureLoop(),console.log(`[DanmuCapture] Capture started with interval ${this.config.captureIntervalMs}ms`),this.sendStatus("capturing"),!0)}stopCapture(){return this.captureTimer&&(clearTimeout(this.captureTimer),this.captureTimer=null),this.isCapturing=!1,this.isPaused=!1,console.log("[DanmuCapture] Capture stopped"),this.sendStatus("stopped"),!0}pauseCapture(){return this.isCapturing?(this.isPaused=!0,console.log("[DanmuCapture] Capture paused"),this.sendStatus("paused"),!0):!1}resumeCapture(){return this.isCapturing?(this.isPaused=!1,console.log("[DanmuCapture] Capture resumed"),this.sendStatus("capturing"),!0):!1}async initOcrService(){try{await ie(),this.ocrInitialized=!0,console.log("[DanmuCapture] OCR service initialized")}catch(e){console.error("[DanmuCapture] Failed to initialize OCR:",e)}}captureLoop(){this.isCapturing&&(this.isPaused||this.performCapture(),this.captureTimer=setTimeout(()=>{this.captureLoop()},this.config.captureIntervalMs))}async performCapture(){try{if(this.captureRegionRect){await this.captureRegion(this.captureRegionRect).then(e=>{e.length>0&&this.sendDanmuBatch(e)});return}this.config.useOCR?await this.captureWithOCR():await this.captureWithDOM()}catch(e){console.error("[DanmuCapture] Capture error:",e)}}async captureWithDOM(){const e=this.generateSimulatedDanmu();if(e.length>0){const t=this.deduplicateDanmu(e);t.length>0&&this.sendDanmuBatch(t)}}async captureWithOCR(){var e,t,r;try{const n=(e=this.selectedWindow)==null?void 0:e.isChildWindow,s=(t=this.selectedWindow)==null?void 0:t.id;let o;if(this.config.ocrEngine==="cloud"&&(o=await((r=this.mainWindow)==null?void 0:r.webContents.executeJavaScript(`
          (function() {
            const item = localStorage.getItem('wordshot_config_ai_providers.json');
            if (item) {
              try {
                const config = JSON.parse(item);
                const enabled = config.providers && config.providers.find(function(p) { return p.enabled; });
                if (enabled) {
                  return {
                    baseURL: enabled.baseURL,
                    apiKey: enabled.apiKey || undefined,
                    model: enabled.model,
                    timeout: enabled.timeout || 120000
                  };
                }
              } catch (e) {}
            }
            return null;
          })()
        `))??void 0),n&&s){await this.captureChildWindowWithOCR(s,o);return}const l=(await a.desktopCapturer.getSources({types:["window"],thumbnailSize:{width:1920,height:1080}})).find(u=>{var S;return u.name===((S=this.selectedWindow)==null?void 0:S.title)||u.name.includes(this.config.windowTitle)});if(!l){console.log("[DanmuCapture] Target window not found for OCR");return}const w=l.thumbnail.toPNG(),y=await k(w,o);console.log(`[DanmuCapture] OCR result: ${y.text.slice(0,100)}...`);const m=G(y.text),p=[];for(const u of m){if(!K(u.content))continue;const S=j(u.content,u.username),b=this.createDanmu(u.username,u.content,S);p.push(b)}if(p.length>0){const u=this.deduplicateDanmu(p);u.length>0&&this.sendDanmuBatch(u)}}catch(n){console.error("[DanmuCapture] OCR capture error:",n)}}async captureChildWindowWithOCR(e,t){try{const n=await P.getInstance().captureWindow(e);if(!n){console.log("[DanmuCapture] Failed to capture child window");return}const s=await k(n,t);console.log(`[DanmuCapture] OCR result from child window: ${s.text.slice(0,100)}...`);const o=G(s.text),c=[];for(const l of o){if(!K(l.content))continue;const w=j(l.content,l.username),y=this.createDanmu(l.username,l.content,w);c.push(y)}if(c.length>0){const l=this.deduplicateDanmu(c);l.length>0&&this.sendDanmuBatch(l)}}catch(r){console.error("[DanmuCapture] Child window OCR capture error:",r)}}generateSimulatedDanmu(){const e=[{username:"用户A",content:"主播真好看",type:"praise"},{username:"用户B",content:"支持下",type:"normal"},{username:"用户C",content:"关注了",type:"follower"}],t=Math.floor(Math.random()*3);return e.slice(0,t).map(n=>this.createDanmu(n.username,n.content,n.type))}createDanmu(e,t,r){return{id:me.randomUUID(),userId:this.generateUserId(e),username:e,content:t,type:r,timestamp:Date.now(),importance:this.calculateImportance(r,t),sentiment:this.calculateSentiment(r,t),selectedForReply:!1}}generateUserId(e){let t=0;for(let r=0;r<e.length;r++){const n=e.charCodeAt(r);t=(t<<5)-t+n,t=t&t}return`user_${Math.abs(t).toString(36)}`}calculateImportance(e,t){return e==="big_gift"||e==="vip"?"highlight":e==="hater"||e==="provocative"?"danger":"normal"}calculateSentiment(e,t){switch(e){case"praise":case"gift":case"big_gift":case"follower":return .7;case"hater":case"provocative":return-.7;case"question":return .3;default:return 0}}deduplicateDanmu(e){const t=Date.now(),r=[];for(const s of e){const o=`${s.userId}:${s.content}`,c=this.dedupState.seenDanmu.get(o);c&&t-c.timestamp<this.dedupTimeWindowMs||this.dedupState.recentContents.some(w=>this.calculateSimilarity(s.content,w)>this.dedupSimilarityThreshold)||(this.dedupState.seenDanmu.set(o,{timestamp:t,content:s.content}),this.dedupState.recentContents.push(s.content),this.dedupState.recentContents.length>100&&this.dedupState.recentContents.shift(),r.push(s))}const n=t-this.dedupTimeWindowMs;for(const[s,o]of this.dedupState.seenDanmu.entries())o.timestamp<n&&this.dedupState.seenDanmu.delete(s);return r}calculateSimilarity(e,t){if(e===t)return 1;if(e.length===0||t.length===0)return 0;const r=new Set(e),n=new Set(t);let s=0;for(const c of r)n.has(c)&&s++;const o=r.size+n.size-s;return s/o}sendDanmuBatch(e){!this.mainWindow||this.mainWindow.isDestroyed()||this.mainWindow.webContents.send(E.DANMU_BATCH,e)}sendDanmu(e){!this.mainWindow||this.mainWindow.isDestroyed()||this.mainWindow.webContents.send(E.DANMU_NEW,e)}sendError(e){!this.mainWindow||this.mainWindow.isDestroyed()||this.mainWindow.webContents.send(E.CAPTURE_ERROR,e)}sendStatus(e){!this.mainWindow||this.mainWindow.isDestroyed()||this.mainWindow.webContents.send(E.CAPTURE_STATUS,{status:e,config:this.config,selectedWindow:this.selectedWindow})}getStatus(){return{isCapturing:this.isCapturing,isPaused:this.isPaused,config:this.config}}destroy(){this.stopCapture(),this.dedupState={seenDanmu:new Map,recentContents:[]},console.log("[DanmuCapture] Service destroyed")}};g(A,"instance",null);let H=A,R=null;function q(){return ee(),R=new a.BrowserWindow({width:1200,height:800,transparent:!0,frame:!1,webPreferences:{preload:L.join(__dirname,"preload.js"),contextIsolation:!0,nodeIntegration:!1}}),R.setBackgroundColor("#00000000"),process.env.NODE_ENV==="development"?(R.loadURL("http://localhost:5173"),R.webContents.openDevTools()):R.loadFile(L.join(__dirname,"../dist/index.html")),_.getInstance().initialize(R),H.getInstance().initialize(R),console.log("[Main] About to register handlers..."),fe(),ve(),console.log("[Main] All handlers registered"),R}a.app.whenReady().then(()=>{q(),a.app.on("activate",()=>{a.BrowserWindow.getAllWindows().length===0&&q()})});a.app.on("window-all-closed",()=>{_.getInstance().destroy(),H.getInstance().destroy(),a.globalShortcut.unregisterAll(),process.platform!=="darwin"&&a.app.quit()});a.app.on("will-quit",()=>{a.globalShortcut.unregisterAll()});
