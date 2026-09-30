/* Burger Town Leagues — shared game core (daily system, storage, autocomplete, share). */
(function(){
"use strict";
var LAUNCH="2026-09-29", SITE="burgertownleagues.com";
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
var store={
  get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},
  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},
  json:function(k){try{return JSON.parse(localStorage.getItem(k)||"null");}catch(e){return null;}}
};
function etDate(d){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(d||new Date());}
function dayMs(s){var p=s.split("-");return Date.UTC(+p[0],+p[1]-1,+p[2]);}
function dayNum(date){return Math.max(1,Math.round((dayMs(date)-dayMs(LAUNCH))/864e5)+1);}
function shiftDay(date,n){var d=new Date(dayMs(date)+n*864e5);return d.toISOString().slice(0,10);}
function hashStr(s){var h=1779033703^s.length;for(var i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function rng(seed){return mulberry32(hashStr(seed)());}
function shuffle(arr,r){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(r()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function pick(arr,r){return arr[Math.floor(r()*arr.length)];}
function norm(s){return String(s).toLowerCase().replace(/[^a-z0-9]/g,"");}

/* ---- data prep ---- */
function prep(D){
  var teams={}, idc={};
  D.teams.forEach(function(t){teams[t.id]=t;});
  D.players.forEach(function(p){idc[p.id]=p.c;});
  var byC={};
  D.players.forEach(function(p){
    var e=byC[p.c]||(byC[p.c]={c:p.c,names:{},rows:[]});
    e.names[p.n]=1;e.names[p.c]=1;e.rows.push(p);
  });
  var list=Object.keys(byC).map(function(k){
    var e=byC[k];
    e.rows.sort(function(a,b){return a.s-b.s;});
    e.seasons=e.rows.length;
    e.k=0;e.d=0;e.champs=0;e.allstars=0;e.mvps=0;e.tm={};e.teamKeys={};e.teamNames=[];e.roles={};e.sset={};
    e.maxKD=0;e.minKD=99;e.maxO=0;e.maxSk=0;e.maxRk=0;e.maxIp=0;
    e.rows.forEach(function(p){
      var t=teams[p.t];
      e.k+=p.k;e.d+=p.d;e.sset[p.s]=1;
      if(p.a.indexOf("CHAMP")>=0)e.champs++;
      if(p.a.indexOf("AS1")>=0||p.a.indexOf("AS2")>=0)e.allstars++;
      if(p.a.indexOf("MVP")>=0)e.mvps++;
      e.roles[p.r]=1;
      if(!t.fa){
        var key=norm(t.name);
        if(!e.teamKeys[key]){e.teamKeys[key]=1;e.teamNames.push(t.name);}
        t.p.forEach(function(id){var o=idc[id];if(o!==e.c)e.tm[o]=1;});
      }
      if(p.kd>e.maxKD)e.maxKD=p.kd; if(p.kd<e.minKD)e.minKD=p.kd;
      if(p.o>e.maxO)e.maxO=p.o;
      if(p.sk!=null&&p.sk>e.maxSk)e.maxSk=p.sk;
      if(p.rk!=null&&p.rk>e.maxRk)e.maxRk=p.rk;
      if(p.ip>e.maxIp)e.maxIp=p.ip;
    });
    e.kd=e.d?e.k/e.d:0;
    e.search=Object.keys(e.names).map(norm).join("|");
    e.aliasList=Object.keys(e.names).filter(function(n){return norm(n)!==norm(e.c);});
    return e;
  });
  list.sort(function(a,b){return a.c.toLowerCase()<b.c.toLowerCase()?-1:1;});
  return {byC:byC,list:list,teams:teams,norm:norm};
}

/* ---- daily results / streak ---- */
function resKey(game,date){return "btlg-res-"+game+"-"+date;}
function getRes(game,date){return store.json(resKey(game,date));}
function saveRes(game,date,obj){store.set(resKey(game,date),JSON.stringify(obj));}
function streak(game){
  var t=etDate(), d=getRes(game,t)?t:shiftDay(t,-1), n=0;
  while(getRes(game,d)){n++;d=shiftDay(d,-1);if(n>999)break;}
  return n;
}

/* ---- copy helper ---- */
function copy(text,btn){
  function ok(){if(btn){var o=btn.dataset.o||btn.textContent;btn.dataset.o=o;btn.textContent="Copied!";setTimeout(function(){btn.textContent=o;},1600);}}
  function fallback(){var ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(ta);ok();}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok,fallback);}else fallback();
}

/* ---- player picker (autocomplete) ---- */
function picker(host,items,opts){
  opts=opts||{};
  host.classList.add("pk");
  host.innerHTML='<input class="pk-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+esc(opts.placeholder||"Type a player name…")+'" aria-label="Player name"><ul class="pk-list" role="listbox" hidden></ul>';
  var inp=host.querySelector("input"), ul=host.querySelector("ul"), cur=[], idx=-1, disabled=false;
  function match(q){
    q=norm(q); if(!q)return [];
    var ex=opts.exclude?opts.exclude():{};
    var a=[],b=[];
    items.forEach(function(it){
      if(ex[it.id])return;
      var s=it.search, i=s.indexOf(q);
      if(i===0)a.push(it);else if(i>0)b.push(it);
    });
    return a.concat(b).slice(0,7);
  }
  function draw(){
    cur=match(inp.value);idx=cur.length?0:-1;
    if(!cur.length){ul.hidden=true;ul.innerHTML="";return;}
    ul.innerHTML=cur.map(function(it,i){return '<li role="option" data-i="'+i+'"'+(i===idx?' class="on"':'')+'>'+esc(it.label)+(it.sub?' <small>'+esc(it.sub)+'</small>':'')+'</li>';}).join("");
    ul.hidden=false;
  }
  function choose(it){if(disabled||!it)return;inp.value="";ul.hidden=true;cur=[];opts.onPick&&opts.onPick(it);}
  inp.addEventListener("input",draw);
  inp.addEventListener("focus",draw);
  inp.addEventListener("keydown",function(e){
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(!cur.length)return;e.preventDefault();idx=(idx+(e.key==="ArrowDown"?1:-1)+cur.length)%cur.length;
      [].forEach.call(ul.children,function(li,i){li.classList.toggle("on",i===idx);});}
    else if(e.key==="Enter"){e.preventDefault();if(cur[idx])choose(cur[idx]);}
    else if(e.key==="Escape"){ul.hidden=true;}
  });
  ul.addEventListener("pointerdown",function(e){var li=e.target.closest("li");if(li){e.preventDefault();choose(cur[+li.dataset.i]);}});
  document.addEventListener("pointerdown",function(e){if(!host.contains(e.target))ul.hidden=true;});
  return {focus:function(){inp.focus();},setDisabled:function(v){disabled=v;inp.disabled=v;if(v)ul.hidden=true;},el:inp};
}

/* ---- game shell: daily/free modes, persistence, end panel ---- */
function shell(o){
  var body=document.getElementById("gm-body"), tabs={daily:document.getElementById("m-daily"),free:document.getElementById("m-free")},
      info=document.getElementById("gm-info"), date=etDate(), num=dayNum(date), mode=null;
  function seedFor(m){return m==="daily"?o.game+"|"+date:o.game+"|free|"+Date.now()+"|"+Math.random();}
  function setInfo(){
    if(mode==="daily"){var s=streak(o.game);info.innerHTML='Daily #'+num+' · new one at midnight ET'+(s?' · <b>'+s+'-day streak</b>':'');}
    else info.textContent="Free play · random rounds, nothing is saved";
    tabs.daily.setAttribute("aria-pressed",mode==="daily");tabs.free.setAttribute("aria-pressed",mode==="free");
  }
  function start(m){
    mode=m;store.set("btlg-mode-"+o.game,m);body.innerHTML="";
    var seed=seedFor(m), dkey="btlg-state-"+o.game+"-"+date;
    var ctx={mode:m,daily:m==="daily",rng:rng(seed),seed:seed,body:body,date:date,num:num,
      saved:m==="daily"?store.json(dkey):null,
      save:function(s){if(m==="daily")store.set(dkey,JSON.stringify(s));},
      again:function(){start("free");window.scrollTo({top:0,behavior:"smooth"});},
      end:function(r){ /* r: {win, headline, detail(html), share(text)} */
        var txt=r.share+"\n"+SITE+"/games/"+o.game;
        if(m==="daily"&&!getRes(o.game,date)){saveRes(o.game,date,{win:!!r.win,share:txt,score:r.score==null?null:r.score});setInfo();}
        var box=document.createElement("div");box.className="gm-end panel";
        box.innerHTML='<div class="gm-endhead '+(r.win?"win":"loss")+'">'+esc(r.headline)+'</div>'+(r.detail?'<div class="gm-enddetail">'+r.detail+'</div>':'')+
          '<textarea class="gm-share" readonly rows="'+(txt.split("\n").length+1)+'">'+esc(txt)+'</textarea>'+
          '<div class="gm-actions"><button class="gbtn primary" data-a="copy">Copy for Discord</button>'+
          (m==="daily"?'<button class="gbtn ghost" data-a="free">Play free rounds</button>':'<button class="gbtn primary" data-a="next">Next round</button>')+
          '<a class="gbtn ghost" href="/games">All games</a></div>';
        box.querySelector('[data-a=copy]').onclick=function(){copy(txt,this);};
        var f=box.querySelector('[data-a=free]');if(f)f.onclick=function(){ctx.again();};
        var n=box.querySelector('[data-a=next]');if(n)n.onclick=function(){start("free");};
        var old=body.querySelector(".gm-end");if(old)old.remove();
        body.appendChild(box);
      }};
    setInfo();
    o.start(ctx);
  }
  tabs.daily.onclick=function(){start("daily");};
  tabs.free.onclick=function(){start("free");};
  start("daily");
}


/* ---- double-elimination bracket (Challonge-style, with connector lines) ---- */
var BR_WIN=[["W1","W2","W3","W4"],["W5","W6"],["W7"],["GF"]], BR_LOS=[["L1","L2"],["L3","L4"],["L5"],["L6"]];
var BR_FEED={W5:["W1","W2"],W6:["W3","W4"],W7:["W5","W6"],L3:["L1"],L4:["L2"],L5:["L3","L4"],L6:["L5"],GF:["W7","L6"]};
var BR_TITLES={W:["Winners round 1","Winners semifinals","Winners final","Grand final"],L:["Losers round 1","Losers round 2","Losers round 3","Losers final"]};
function bracket(host,o){
  var res=o.res, nm=o.name||function(e){return e.name;}, seedOf=o.seed||function(){return "";}, me=o.isMe||function(){return false;};
  function match(id){
    var r=res[id]; if(!r)return '<div class="bm empty" data-m="'+id+'"></div>';
    function row(e,w,sc){return '<div class="bt '+(w?"w":"l")+(me(e)?" me":"")+'"><span class="bs">'+esc(seedOf(e))+'</span><span class="bn">'+esc(nm(e))+'</span><span class="bc">'+sc+'</span></div>';}
    return '<div class="bm'+((me(r.A)||me(r.B))?" mine":"")+'" data-m="'+id+'"><div class="bid">'+id+'</div>'+row(r.A,r.wa>r.wb,r.wa)+row(r.B,r.wb>r.wa,r.wb)+'</div>';
  }
  function section(cols,titles,cls){
    return '<div class="bsec '+cls+'">'+cols.map(function(c,i){return '<div class="bcol"><div class="btitle">'+titles[i]+'</div><div class="bmatches">'+c.map(match).join("")+'</div></div>';}).join("")+'</div>';
  }
  host.innerHTML='<div class="bk"><svg class="bsvg" aria-hidden="true"></svg><div class="bhead">Winners bracket</div>'+section(BR_WIN,BR_TITLES.W,"win")+'<div class="bhead">Losers bracket</div>'+section(BR_LOS,BR_TITLES.L,"los")+'</div>';
  function draw(){
    var bk=host.querySelector(".bk"), svg=host.querySelector(".bsvg"); if(!bk)return;
    var b=bk.getBoundingClientRect(); svg.setAttribute("width",bk.scrollWidth); svg.setAttribute("height",bk.scrollHeight);
    var d="";
    Object.keys(BR_FEED).forEach(function(to){
      var t=bk.querySelector('[data-m="'+to+'"]'); if(!t)return; var tb=t.getBoundingClientRect();
      BR_FEED[to].forEach(function(from){
        var f=bk.querySelector('[data-m="'+from+'"]'); if(!f)return; var fb=f.getBoundingClientRect();
        var x1=fb.right-b.left+bk.scrollLeft, y1=fb.top+fb.height/2-b.top, x2=tb.left-b.left+bk.scrollLeft, y2=tb.top+tb.height/2-b.top, mx=x1+(x2-x1)/2;
        d+='<path d="M'+x1+' '+y1+' H'+mx+' V'+y2+' H'+x2+'"/>';
      });
    });
    svg.innerHTML=d;
  }
  draw(); setTimeout(draw,60);
  if(!host._brResize){host._brResize=1;window.addEventListener("resize",draw);}
}

window.BTL={bracket:bracket,LAUNCH:LAUNCH,SITE:SITE,esc:esc,store:store,etDate:etDate,dayNum:dayNum,shiftDay:shiftDay,hashStr:hashStr,rng:rng,shuffle:shuffle,pick:pick,norm:norm,
  prep:prep,getRes:getRes,saveRes:saveRes,streak:streak,copy:copy,picker:picker,shell:shell};
})();
