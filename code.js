function init() {
  $ui.register((ctx) => {
    const maze = [
      "#############",
      "#.....#.....#",
      "#.##.#.#.##.#",
      "#o...#.#...o#",
      "###.##.##.###",
      "#..... .....#",
      "#.##.###.##.#",
      "#....   ....#",
      "###.#.#.#.###",
      "#.....#.....#",
      "#############"
    ];
    const W = 13, H = maze.length;
    const start = {x: 1, y: 1};
    const ghostStarts = [{x:6,y:7},{x:5,y:7},{x:7,y:7},{x:6,y:5}];
    const state = ctx.state(null);
    const preferences = ctx.settings.define("seapac", { highScore: 0 });
    const high = ctx.state(Number(preferences.get("highScore", 0)) || 0);
    let opened = false;
    function newGame() {
      const pellets = maze.map(r => r.split("").map(c => c === "." || c === "o" ? c : " "));
      pellets[start.y][start.x] = " ";
      return { player: {x:start.x,y:start.y}, ghosts: ghostStarts.map(p=>({x:p.x,y:p.y})), pellets, score:0, lives:3, power:0, direction:{x:0,y:0}, paused:false, over:false, level:1 };
    }
    state.set(newGame());
    const tray = ctx.newTray({iconUrl:"https://raw.githubusercontent.com/5rahim/seanime/main/web/public/favicon.ico",withContent:true,width:"360px"});
    function walk(x,y) { return y>=0 && y<H && x>=0 && x<W && maze[y][x]!=="#"; }
    function resetPositions(s) {
      s.player={x:start.x,y:start.y};
      s.ghosts=ghostStarts.map(p=>({x:p.x,y:p.y}));
      s.direction={x:0,y:0};s.power=0;
    }
    function collision(s) {
      for(let i=0;i<s.ghosts.length;i++){
        const g=s.ghosts[i];
        if(g.x!==s.player.x || g.y!==s.player.y) continue;
        if(s.power>0){s.score+=200;s.ghosts[i]={x:ghostStarts[i].x,y:ghostStarts[i].y};}
        else {s.lives--;if(s.lives<=0){s.over=true;s.paused=true;}else resetPositions(s);return;}
      }
    }
    function tick() {
      if(!opened)return;
      const s=state.get();if(s.paused||s.over)return;
      const d=s.direction;
      if(walk(s.player.x+d.x,s.player.y+d.y)){
        s.player={x:s.player.x+d.x,y:s.player.y+d.y};
      }
      const pellet=s.pellets[s.player.y][s.player.x];
      if(pellet==="."||pellet==="o"){
        s.score+=pellet==="o"?50:10;
        if(pellet==="o")s.power=16;
        s.pellets[s.player.y][s.player.x]=" ";
      }
      collision(s);
      if(!s.over){
        const dirs=[{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}];
        for(let i=0;i<s.ghosts.length;i++){
          const g=s.ghosts[i], choices=dirs.filter(v=>walk(g.x+v.x,g.y+v.y));
          if(!choices.length)continue;
          choices.sort((a,b)=>{
            const da=Math.abs(g.x+a.x-s.player.x)+Math.abs(g.y+a.y-s.player.y);
            const db=Math.abs(g.x+b.x-s.player.x)+Math.abs(g.y+b.y-s.player.y);
            return s.power>0?db-da:da-db;
          });
          const chosen=Math.random()<0.65?choices[0]:choices[Math.floor(Math.random()*choices.length)];
          s.ghosts[i]={x:g.x+chosen.x,y:g.y+chosen.y};
        }
        collision(s);
      }
      if(s.power>0)s.power--;
      if(!s.over && s.pellets.every(row=>row.every(c=>c===" "))){
        const n=newGame();n.score=s.score;n.lives=s.lives;n.level=s.level+1;state.set(n);return;
      }
      if(s.score>high.get()){high.set(s.score);preferences.set("highScore", s.score);}
      state.set({...s});
    }
    ctx.setInterval(tick,450);
    tray.onOpen(()=>{opened=true;});
    tray.onClose(()=>{opened=false;});
    function move(x,y) {
      const s=state.get();if(s.over)return;
      s.direction={x,y};s.paused=false;state.set({...s});
    }
    ctx.registerEventHandler("sp-up",()=>move(0,-1));
    ctx.registerEventHandler("sp-down",()=>move(0,1));
    ctx.registerEventHandler("sp-left",()=>move(-1,0));
    ctx.registerEventHandler("sp-right",()=>move(1,0));
    ctx.registerEventHandler("sp-pause",()=>{const s=state.get();s.paused=!s.paused;state.set({...s});});
    ctx.registerEventHandler("sp-restart",()=>state.set(newGame()));
    tray.render(()=>{
      const s=state.get();
      const rows=maze.map((line,y)=>{
        let out="";
        for(let x=0;x<W;x++){
          const ghost=s.ghosts.findIndex(g=>g.x===x&&g.y===y);
          if(s.player.x===x&&s.player.y===y)out+="🟡";
          else if(ghost>=0)out+=s.power>0?"🔵":["🔴","🩷","🩵","🟠"][ghost];
          else if(line[x]==="#")out+="🟦";
          else if(s.pellets[y][x]==="o")out+="🟠";
          else if(s.pellets[y][x]===".")out+="· ";
          else out+="  ";
        }
        return tray.text(out,{style:{fontFamily:"monospace",whiteSpace:"pre",fontSize:"12px",lineHeight:"16px"}});
      });
      return tray.stack([
        tray.text("SEAPAC  •  LEVEL "+s.level),
        tray.text("Score "+s.score+"   Best "+high.get()+"   Lives "+s.lives),
        tray.stack(rows,{gap:0}),
        tray.text(s.over?"GAME OVER":s.paused?"PAUSED":s.power>0?"POWER MODE":"Collect every pellet!"),
        tray.flex([tray.button({label:"↑",onClick:"sp-up"})],{justify:"center"}),
        tray.flex([
          tray.button({label:"←",onClick:"sp-left"}),
          tray.button({label:"↓",onClick:"sp-down"}),
          tray.button({label:"→",onClick:"sp-right"})
        ],{justify:"center"}),
        tray.flex([
          tray.button({label:s.paused?"Resume":"Pause",onClick:"sp-pause"}),
          tray.button({label:"Restart",onClick:"sp-restart"})
        ],{justify:"center"})
      ],{gap:2});
    });
  });
}
