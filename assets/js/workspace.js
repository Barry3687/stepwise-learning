"use strict";
window.LectureWorkspace = (() => {
  const maxBytes = 10 * 1024 * 1024;
  const ext = file => file.name.toLowerCase().split(".").pop();
  const el = (tag, text, cls) => { const n = document.createElement(tag); if(text !== undefined)n.textContent=text; if(cls)n.className=cls; return n; };
  const action = (text, run) => { const b=el("button",text,"secondary-button");b.type="button";b.onclick=run;return b; };
  async function request(path, payload) {
    const controller = new AbortController(), timer=setTimeout(()=>controller.abort(),65000);
    try {
      const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:controller.signal});
      if(!(response.headers.get("Content-Type")||"").includes("application/json"))throw Error("尚未連接本機 AI／文件解析後端");
      const data=await response.json();if(!response.ok)throw Error(data.error||"處理失敗");return data;
    } finally {clearTimeout(timer);}
  }
  function readData(file) {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error("檔案讀取失敗"));reader.readAsDataURL(file);});}
  async function imageData(file) {
    if(!["image/png","image/jpeg"].includes(file.type) || file.size>maxBytes)throw Error("請使用 10 MB 以下的 PNG 或 JPG 圖片");
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    return canvas.toDataURL("image/jpeg",.85);
  }
  function dropZone(zone, callback) {
    zone.addEventListener("dragover",e=>{e.preventDefault();zone.classList.add("dragover");});
    zone.addEventListener("dragleave",()=>zone.classList.remove("dragover"));
    zone.addEventListener("drop",e=>{e.preventDefault();zone.classList.remove("dragover");callback([...e.dataTransfer.files]);});
  }
  function screenshotInput(panel, conceptId, images) {
    const area=el("div",undefined,"drop-zone");area.tabIndex=0;
    area.append(el("strong","上傳算式截圖批改區"),el("p","點擊選圖、拖曳圖片，或在本作答區按 Ctrl+V。PNG／JPG，最多一張。","fine-print"));
    const input=el("input");input.type="file";input.accept="image/png,image/jpeg";input.setAttribute("aria-label","選擇算式截圖");
    const preview=el("div"), status=el("p","","fine-print");status.setAttribute("role","status");
    const draw=()=>{preview.replaceChildren();if(!images.has(conceptId))return;const image=el("img");image.src=images.get(conceptId);image.alt="待批改的算式截圖";image.className="answer-image";preview.append(image,action("清除圖片",()=>{images.delete(conceptId);input.value="";draw();}));};
    const load=async files=>{if(!files.length)return;try{images.set(conceptId,await imageData(files[0]));status.textContent="圖片已備妥，送出批改時才會傳送。";draw();}catch(e){status.textContent=e.message;}};
    input.onchange=()=>load([...input.files]);dropZone(area,load);
    panel.addEventListener("paste",e=>{const files=[...e.clipboardData.items].filter(i=>i.kind==="file"&&i.type.startsWith("image/")).map(i=>i.getAsFile());if(files.length){e.preventDefault();load(files);}});
    area.append(input,preview,status);draw();return area;
  }
  let chapterEM=false, uploadEM=false;
  const labs=[];
  function updateLabs(){labs.forEach(l=>l(chapterEM||uploadEM));}
  function setSubject(subject){chapterEM=subject==="electromagnetics";updateLabs();}
  function coordinateLab(host, point=[2,1,2]) {
    const section=el("section",undefined,"coordinate-lab");section.append(el("h2","立體座標探索"));
    const fields=el("form",undefined,"coordinate-fields"), inputs=[];
    ["X","Y","Z"].forEach((name,i)=>{const label=el("label",name), input=el("input");input.type="number";input.step="any";input.min=-1e6;input.max=1e6;input.required=true;input.value=point[i];label.append(input);fields.append(label);inputs.push(input);});
    const submit=el("button","更新座標圖","secondary-button");submit.type="submit";fields.append(submit);
    const switchLabel=el("label","座標系統（電磁學） "), select=el("select");select.setAttribute("aria-label","座標系統");
    [["cartesian","卡氏 XYZ"],["cylindrical","圓柱 ρ, φ, z"],["spherical","球面 r, θ, φ"]].forEach(([value,text])=>{const option=el("option",text);option.value=value;select.append(option);});switchLabel.append(select);switchLabel.hidden=true;
    const note=el("p","預設卡氏座標。只有電磁學教材啟用座標系切換。","fine-print"), chart=el("div",undefined,"coordinate-chart"), status=el("p");status.setAttribute("role","status");
    const draw=()=>{try {const values=inputs.map(i=>i.value.trim()===""?NaN:Number(i.value));chart.replaceChildren(LectureFigures.coordinateDiagram(values,select.value));status.textContent="";}catch(e){status.textContent=e.message;}};
    labs.push(enabled=>{switchLabel.hidden=!enabled;if(!enabled)select.value="cartesian";draw();});
    fields.onsubmit=e=>{e.preventDefault();draw();};select.onchange=draw;
    section.append(fields,switchLabel,note,chart,status);host.append(section);updateLabs();return section;
  }
  function materials(host) {
    if(location.hostname === "barry3687.github.io") {
      const panel=el("section",undefined,"upload-panel");
      panel.append(el("h2","使用 AI 整理講義"),el("p","AI 整理與圖片批改已移至私人線上工作區。登入後設定一次 Groq 金鑰，即可直接在網頁使用，不必啟動本機服務。","fine-print"));
      const link=el("a","開啟私人 AI 學習工作區 →","action-button");link.href="https://stepwise-ai-barry3687.fantasticstarfish16.chatgpt.site/";panel.append(link);host.append(panel);return;
    }
    const section=el("section",undefined,"upload-panel");section.append(el("h2","講義與資料上傳區"),el("p","檔案只保留在本頁記憶體，重新整理後清除；不會加入公開網站。每份上限 10 MB，最多 5 份。","fine-print"));
    const zone=el("label",undefined,"drop-zone");zone.append(el("strong","拖曳講義至此，或點擊選擇檔案"));
    const picker=el("input");picker.type="file";picker.multiple=true;picker.accept=".pdf,.md,.txt,.docx,.png,.jpg,.jpeg";zone.append(picker);
    const list=el("div"), notice=el("p","","fine-print");notice.setAttribute("role","status");
    const consentLabel=el("label",undefined,"consent"), consent=el("input");consent.type="checkbox";consentLabel.append(consent,document.createTextNode("我同意按下整理時，將該份講義內容或圖片交給後端模型服務。"));
    const records=[];
    const refreshSubject=()=>{uploadEM=records.some(r=>r.em);updateLabs();};
    const load=async files=>{
      for(const file of files){
        if(records.length>=5){notice.textContent="最多保留 5 份，請先移除。";break;}
        if(!["pdf","md","txt","docx","png","jpg","jpeg"].includes(ext(file))||file.size>maxBytes){notice.textContent=`${file.name}：格式不支援或超過 10 MB。`;continue;}
        const record={file,em:false,active:true,text:null};records.push(record);
        const card=el("article",undefined,"file-card"), title=el("strong",`${file.name} · ${(file.size/1024).toFixed(1)} KB`), state=el("p","已讀取檔案，等待處理。","fine-print"), preview=el("div");
        state.setAttribute("role","status");
        const subjectLabel=el("label",undefined,"consent"), em=el("input");em.type="checkbox";em.onchange=()=>{record.em=em.checked;refreshSubject();};subjectLabel.append(em,document.createTextNode("這份講義屬於電磁學（啟用座標切換）"));
        const remove=action("移除",()=>{record.active=false;const i=records.indexOf(record);if(i>=0)records.splice(i,1);if(record.url)URL.revokeObjectURL(record.url);card.remove();refreshSubject();});
        const extract=async()=>{
          if(record.text!==null)return record.text;
          const data=await request("/api/extract",{name:file.name,data:await readData(file)});record.text=data.text;return record.text;
        };
        const parse=action("解析文字",async()=>{parse.disabled=true;state.textContent="正在解析…";try{const text=await extract();preview.replaceChildren(el("pre",text,"file-preview"));state.textContent="文字解析完成，請核對公式與缺頁。";}catch(e){state.textContent=e.message;}finally{parse.disabled=false;}});
        const organize=action("整理重點／生成基礎題",async()=>{
          if(!consent.checked){state.textContent="請先確認資料傳送說明。";return;}organize.disabled=true;state.textContent="正在整理…";
          try{const image=["png","jpg","jpeg"].includes(ext(file))?await imageData(file):null;const data=await request("/api/organize",{name:file.name,text:image?"":await extract(),image});if(record.active){preview.append(el("pre",data.feedback,"file-preview"));state.textContent="AI 整理草稿完成，尚未建立正式章節。請核對原文、公式與題目。";}}
          catch(e){state.textContent=`整理未完成：${e.message}`;}finally{organize.disabled=false;}
        });
        card.append(title,subjectLabel,preview,el("div",undefined,"upload-actions"),state);card.querySelector(".upload-actions").append(parse,organize,remove);list.append(card);
        if(["txt","md"].includes(ext(file))){record.text=await file.text();preview.append(el("pre",record.text.slice(0,100000),"file-preview"));state.textContent="文字預覽完成。";parse.hidden=true;}
        else if(["png","jpg","jpeg"].includes(ext(file))){record.url=URL.createObjectURL(file);const img=el("img");img.src=record.url;img.alt=file.name;img.className="file-image";preview.append(img);parse.hidden=true;state.textContent="圖片已預覽；整理需要後端視覺模型。";}
        else if(ext(file)==="pdf"){record.url=URL.createObjectURL(file);const frame=el("iframe");frame.src=record.url;frame.title=file.name;frame.className="file-pdf";preview.append(frame);state.textContent="PDF 已載入預覽；文字解析需要本機後端，掃描版請改用清楚的圖片。";}
        else state.textContent="DOCX 已備妥；按解析文字使用本機後端。";
      }
      picker.value="";
    };
    picker.onchange=()=>load([...picker.files]);dropZone(zone,load);section.append(zone,notice,consentLabel,list);host.append(section);
  }
  document.addEventListener("DOMContentLoaded",()=>{const host=document.querySelector("#materials-workspace");if(host){materials(host);if(!document.body.dataset.chapter)coordinateLab(host);}});
  return {request,imageData,screenshotInput,coordinateLab,setSubject};
})();
