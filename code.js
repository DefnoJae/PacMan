function init() {
  $ui.register((ctx) => {
    const MAP = [
      "###################",
      "#........#........#",
      "#.##.###.#.###.##.#",
      "#o##.###.#.###.##o#",
      "#.................#",
      "#.##.#.#####.#.##.#",
      "#....#...#...#....#",
      "####.### # ###.####",
      "####.#       #.####",
      "####.# ## ## #.####",
      "    .  #   #  .    ",
      "####.# ##### #.####",
      "####.#       #.####",
      "####.# ##### #.####",
      "#........#........#",
      "#.##.###.#.###.##.#",
      "#o.#..... .....#.o#",
      "##.#.#.#####.#.#.##",
      "#....#...#...#....#",
      "#.######.#.######.#",
      "#.................#",
      "###################"
];
    const W = 19, H = MAP.length, TILE = 16;
    const START = { x: 9, y: 16 };
    const GHOST_STARTS = [{x:9,y:10},{x:8,y:10},{x:10,y:10},{x:9,y:9}];
    const DIRECTIONS = [{x:0,y:-1},{x:-1,y:0},{x:0,y:1},{x:1,y:0}];
    const COLORS = ["#ff3434","#ffb8de","#42e7f6","#ffad3d"];
    const prefs = ctx.settings.define("seapac", { highScore: 0 });
    const high = ctx.state(Number(prefs.get("highScore", 0)) || 0);
    const game = ctx.state(null);
    let opened = false;
    let tickNumber = 0;

    function fresh(score, lives, level) {
      const dots = MAP.map(row => row.split("").map(c => c === "." || c === "o" ? c : " "));
      dots[START.y][START.x] = " ";
      return {
        dots: dots, player: {x:START.x,y:START.y},
        ghosts: GHOST_STARTS.map(p => ({x:p.x,y:p.y})),
        dir: {x:0,y:0}, wanted: {x:0,y:0},
        score: score || 0, lives: lives === undefined ? 3 : lives,
        level: level || 1, power: 0, grace: 12,
        paused: true, over: false, ready: true
      };
    }
    game.set(fresh(0,3,1));
    const tray = ctx.newTray({
      iconUrl: "https://raw.githubusercontent.com/DefnoJae/PacMan/main/icon.svg",
      withContent: true, width: "385px", minHeight: "570px"
    });

    function pass(x,y) {
      if (y < 0 || y >= H) return false;
      if (x < 0 || x >= W) return y === 10;
      return MAP[y][x] !== "#";
    }
    function position(x,y) {
      if (x < 0) x = W - 1;
      if (x >= W) x = 0;
      return {x:x,y:y};
    }
    function respawn(s) {
      s.player = {x:START.x,y:START.y};
      s.ghosts = GHOST_STARTS.map(p => ({x:p.x,y:p.y}));
      s.dir = {x:0,y:0}; s.wanted = {x:0,y:0};
      s.power = 0; s.grace = 12; s.paused = true; s.ready = true;
    }
    function touch(s) {
      if (s.grace > 0) return;
      for (let i=0; i<s.ghosts.length; i++) {
        const g=s.ghosts[i];
        if (g.x !== s.player.x || g.y !== s.player.y) continue;
        if (s.power > 0) {
          s.score += 200;
          s.ghosts[i] = {x:GHOST_STARTS[i].x,y:GHOST_STARTS[i].y};
        } else {
          s.lives--;
          if (s.lives <= 0) {s.over=true;s.paused=true;s.ready=false;}
          else respawn(s);
          return;
        }
      }
    }
    function step() {
      if (!opened) return;
      const s=game.get();
      if (s.paused || s.over) return;
      tickNumber++;
      if (s.grace > 0) s.grace--;
      if (pass(s.player.x+s.wanted.x,s.player.y+s.wanted.y)) {
        s.dir = {x:s.wanted.x,y:s.wanted.y};
      }
      if (pass(s.player.x+s.dir.x,s.player.y+s.dir.y)) {
        s.player=position(s.player.x+s.dir.x,s.player.y+s.dir.y);
      }
      const dot=s.dots[s.player.y][s.player.x];
      if (dot === "." || dot === "o") {
        s.score += dot === "o" ? 50 : 10;
        if (dot === "o") s.power = 28;
        s.dots[s.player.y][s.player.x] = " ";
      }
      touch(s);
      if (!s.paused && !s.over && tickNumber % 2 === 0) {
        for (let i=0; i<s.ghosts.length; i++) {
          const g=s.ghosts[i];
          const possible=DIRECTIONS.filter(d => pass(g.x+d.x,g.y+d.y));
          if (!possible.length) continue;
          const flee=s.power > 0;
          const target = i === 0 ? s.player :
            i === 1 ? {x:s.player.x+s.dir.x*3,y:s.player.y+s.dir.y*3} :
            i === 2 ? {x:W-2,y:H-2} : {x:1,y:1};
          possible.sort((a,b) => {
            const da=Math.abs(g.x+a.x-target.x)+Math.abs(g.y+a.y-target.y);
            const db=Math.abs(g.x+b.x-target.x)+Math.abs(g.y+b.y-target.y);
            return flee ? db-da : da-db;
          });
          const chosen=Math.random()<0.75?possible[0]:possible[Math.floor(Math.random()*possible.length)];
          s.ghosts[i]=position(g.x+chosen.x,g.y+chosen.y);
        }
        touch(s);
      }
      if (s.power > 0) s.power--;
      if (!s.over && s.dots.every(row=>row.every(c=>c===" "))) {
        const next=fresh(s.score,s.lives,s.level+1);
        game.set(next);tray.update();return;
      }
      if (s.score > high.get()) {
        high.set(s.score);
        prefs.set("highScore",s.score);
      }
      game.set({...s});
      tray.update();
    }
    ctx.setInterval(step, 180);
    tray.onOpen(()=>{opened=true;tray.update();});
    tray.onClose(()=>{opened=false;});
    function direction(dx,dy) {
      const s=game.get();if(s.over)return;
      s.wanted={x:dx,y:dy};
      if(s.ready) {s.dir={x:dx,y:dy};s.ready=false;}
      s.paused=false;game.set({...s});tray.update();
    }
    ctx.registerEventHandler("seapac-up",()=>direction(0,-1));
    ctx.registerEventHandler("seapac-down",()=>direction(0,1));
    ctx.registerEventHandler("seapac-left",()=>direction(-1,0));
    ctx.registerEventHandler("seapac-right",()=>direction(1,0));
    ctx.registerEventHandler("seapac-pause",()=>{
      const s=game.get();if(s.over)return;
      s.paused=!s.paused;s.ready=false;game.set({...s});tray.update();
    });
    ctx.registerEventHandler("seapac-restart",()=>{
      tickNumber=0;game.set(fresh(0,3,1));tray.update();
    });

    function circle(x,y,r,color) {
      return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+color+'"/>';
    }
    function ghostSVG(g,i,frightened) {
      const x=g.x*TILE+TILE/2,y=g.y*TILE+TILE/2;
      const col=frightened?"#243eff":COLORS[i];
      const left=x-6.4, right=x+6.4, top=y-6.4, bottom=y+6.5;
      let out='<path d="M '+left+' '+bottom+' L '+left+' '+y+' A 6.4 6.4 0 0 1 '+right+' '+y+
        ' L '+right+' '+bottom+' L '+(right-2.1)+' '+(bottom-2.4)+' L '+(right-4.2)+' '+bottom+
        ' L '+(right-6.3)+' '+(bottom-2.4)+' L '+(right-8.4)+' '+bottom+
        ' L '+(right-10.5)+' '+(bottom-2.4)+' L '+left+' '+bottom+' Z" fill="'+col+'"/>';
      if (frightened) {
        out+=circle(x-3,y-1,1.3,"#fff")+circle(x+3,y-1,1.3,"#fff");
        out+='<path d="M '+(x-4)+' '+(y+4)+' l 2 -2 l 2 2 l 2 -2 l 2 2" fill="none" stroke="#fff" stroke-width="1"/>';
      } else {
        out+='<ellipse cx="'+(x-3)+'" cy="'+(y-1)+'" rx="2.7" ry="3.3" fill="#fff"/>';
        out+='<ellipse cx="'+(x+3)+'" cy="'+(y-1)+'" rx="2.7" ry="3.3" fill="#fff"/>';
        out+=circle(x-2.4,y-0.5,1.25,"#163cfa")+circle(x+3.6,y-0.5,1.25,"#163cfa");
      }
      return out;
    }
    function playerSVG(s) {
      const x=s.player.x*TILE+TILE/2,y=s.player.y*TILE+TILE/2;
      if (s.grace>0 && !s.ready && tickNumber%2===0) return "";
      let angle=0;
      if(s.dir.x===-1)angle=180;
      else if(s.dir.y===-1)angle=270;
      else if(s.dir.y===1)angle=90;
      const mouth=tickNumber%2===0?36:18;
      const rad=mouth*Math.PI/180, r=7;
      const x1=x+r*Math.cos(rad),y1=y+r*Math.sin(rad);
      const x2=x+r*Math.cos(-rad),y2=y+r*Math.sin(-rad);
      return '<path d="M '+x+' '+y+' L '+x1+' '+y1+' A '+r+' '+r+' 0 1 1 '+x2+' '+y2+
        ' Z" fill="#ffe900" transform="rotate('+angle+' '+x+' '+y+')"/>';
    }
    function boardSVG(s) {
      let svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+(W*TILE)+'" height="'+(H*TILE)+
        '" viewBox="0 0 '+(W*TILE)+' '+(H*TILE)+'">';
      svg+='<rect width="100%" height="100%" fill="#000"/>';
      svg+='<g fill="none" stroke="#154dff" stroke-width="1.6" stroke-linecap="round">';
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(MAP[y][x]!=="#")continue;
        const X=x*TILE,Y=y*TILE;
        if(y===0 || MAP[y-1][x]!=="#")svg+='<path d="M '+X+' '+(Y+2)+' H '+(X+TILE)+'"/>';
        if(y===H-1 || MAP[y+1][x]!=="#")svg+='<path d="M '+X+' '+(Y+TILE-2)+' H '+(X+TILE)+'"/>';
        if(x===0 || MAP[y][x-1]!=="#")svg+='<path d="M '+(X+2)+' '+Y+' V '+(Y+TILE)+'"/>';
        if(x===W-1 || MAP[y][x+1]!=="#")svg+='<path d="M '+(X+TILE-2)+' '+Y+' V '+(Y+TILE)+'"/>';
      }
      svg+='</g>';
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const dot=s.dots[y][x];
        if(dot==="."||dot==="o")svg+=circle(x*TILE+8,y*TILE+8,dot==="o"?4.1:1.7,"#ffdbba");
      }
      for(let i=0;i<s.ghosts.length;i++)svg+=ghostSVG(s.ghosts[i],i,s.power>0);
      svg+=playerSVG(s);
      if(s.paused || s.over){
        const label=s.over?"GAME OVER":s.ready?"READY!":"PAUSED";
        svg+='<rect x="65" y="155" width="174" height="34" rx="3" fill="#000" opacity=".92"/>';
        svg+='<text x="152" y="178" text-anchor="middle" font-family="monospace" font-size="19" font-weight="bold" fill="'+(s.over?"#ff3333":"#ffe600")+'">'+label+'</text>';
      }
      svg+='</svg>';
      return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    }

    tray.render(()=>{
      const s=game.get();
      const board=tray.img({
        src:boardSVG(s),alt:"SeaPac arcade maze",
        width:"304",height:"352",
        style:{display:"block",width:"304px",height:"352px",imageRendering:"pixelated"}
      });
      return tray.stack([
        tray.div({items:[
          tray.text("1UP                         HIGH SCORE",{
            style:{fontFamily:"monospace",fontWeight:"bold",fontSize:"12px",letterSpacing:"1px",color:"#fff",textAlign:"center"}
          }),
          tray.text(String(s.score).padStart(6,"0")+"                       "+String(high.get()).padStart(6,"0"),{
            style:{fontFamily:"monospace",fontWeight:"bold",fontSize:"15px",color:"#fff",textAlign:"center",whiteSpace:"pre"}
          })
        ],style:{backgroundColor:"#000",padding:"9px 4px 2px"}}),
        tray.div({items:[board],style:{display:"flex",justifyContent:"center",backgroundColor:"#000",padding:"0px"}}),
        tray.div({items:[
          tray.text("● ".repeat(s.lives)+"      LEVEL "+s.level+(s.power>0?"    POWER!":""),
            {style:{fontFamily:"monospace",fontSize:"13px",color:"#ffe600",textAlign:"center"}})
        ],style:{backgroundColor:"#000",padding:"3px 0 8px"}}),
        tray.flex([tray.button({label:"▲",onClick:"seapac-up",size:"sm"})],{gap:1,style:{justifyContent:"center"}}),
        tray.flex([
          tray.button({label:"◀",onClick:"seapac-left",size:"sm"}),
          tray.button({label:"▼",onClick:"seapac-down",size:"sm"}),
          tray.button({label:"▶",onClick:"seapac-right",size:"sm"})
        ],{gap:1,style:{justifyContent:"center"}}),
        tray.flex([
          tray.button({label:s.paused?"Resume":"Pause",onClick:"seapac-pause",size:"sm"}),
          tray.button({label:"New Game",onClick:"seapac-restart",size:"sm"})
        ],{gap:2,style:{justifyContent:"center",paddingTop:"5px"}})
      ],{gap:1,style:{backgroundColor:"#000",padding:"8px",border:"2px solid #183eff",borderRadius:"8px"}});
    });
  });
}
