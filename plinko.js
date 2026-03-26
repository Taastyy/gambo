/**
 * ============================================================
 *  PLINKO – Built from scratch
 *  Features: variable rows, 3 risk tiers, auto-drop,
 *  Web Audio peg pings, screen shake, confetti, motion trails
 * ============================================================
 */
(function () {
    'use strict';

    /* ======= constants ======= */
    var CW = 660, CH = 760;
    var PEG_R = 3.5, BALL_R = 6.5;
    var G = 0.35, DAMP = 0.46, MAX_V = 13;
    var SLOT_H = 42;

    /* multipliers – all have expected value < 1 (house edge) */
    var TABLES = {
        8: {
            low: [3.0, 1.2, 0.6, 0.4, 0.4, 0.6, 1.2, 3.0],
            medium: [6.0, 1.8, 0.7, 0.3, 0.3, 0.7, 1.8, 6.0],
            high: [16, 2.5, 0.5, 0.2, 0.2, 0.5, 2.5, 16]
        },
        12: {
            low: [4.0, 1.5, 0.9, 0.6, 0.4, 0.3, 0.3, 0.4, 0.6, 0.9, 1.5, 4.0],
            medium: [9.0, 3.0, 1.3, 0.7, 0.3, 0.2, 0.2, 0.3, 0.7, 1.3, 3.0, 9.0],
            high: [30, 5.0, 1.8, 0.5, 0.2, 0.1, 0.1, 0.2, 0.5, 1.8, 5.0, 30]
        },
        16: {
            low: [5.0, 1.8, 1.1, 0.8, 0.5, 0.4, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.8, 1.1, 1.8, 5.0],
            medium: [15, 4.0, 1.5, 0.8, 0.4, 0.3, 0.2, 0.1, 0.1, 0.2, 0.3, 0.4, 0.8, 1.5, 4.0, 15],
            high: [50, 9.0, 2.5, 0.7, 0.3, 0.2, 0.1, 0.0, 0.0, 0.1, 0.2, 0.3, 0.7, 2.5, 9.0, 50]
        }
    };

    var RISK_PAL = {
        low: { peg: '#00e676', glow: 'rgba(0,230,118,.45)', ball: '#69f0ae', accent: '#00e676', bg: 'rgba(0,230,118,' },
        medium: { peg: '#ffc400', glow: 'rgba(255,196,0,.45)', ball: '#ffe57f', accent: '#ffc400', bg: 'rgba(255,196,0,' },
        high: { peg: '#ff1744', glow: 'rgba(255,23,68,.45)', ball: '#ff616f', accent: '#ff1744', bg: 'rgba(255,23,68,' }
    };

    /* ======= state ======= */
    var bet = 100, nRows = 16, risk = 'medium';
    var pegs = [], slots = [], balls = [], fx = [];
    var stats = { games: 0, wins: 0, losses: 0, totalWon: 0, totalLost: 0, maxMult: 0, maxWin: 0 };
    var canvas, ctx, raf = null;
    var autoMode = false, autoTimer = null;

    /* ======= audio engine ======= */
    var ac = null;
    function ensureAudio() { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    function ping(freq, dur, vol, type) {
        if (!ac) return;
        try {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = type || 'sine'; o.frequency.value = freq;
            g.gain.setValueAtTime(vol, ac.currentTime);
            g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dur);
            o.connect(g); g.connect(ac.destination);
            o.start(); o.stop(ac.currentTime + dur);
        } catch (e) { }
    }
    function sfxPeg() { ping(700 + Math.random() * 800, .035, .025, 'sine'); }
    function sfxWin(big) {
        ping(523, .12, .07, 'sine');
        setTimeout(function () { ping(659, .12, .07, 'sine'); }, 80);
        if (big) setTimeout(function () { ping(784, .18, .09, 'sine'); setTimeout(function () { ping(1047, .22, .1, 'sine'); }, 100); }, 160);
    }
    function sfxLose() { ping(220, .12, .035, 'triangle'); }
    function sfxDrop() { ping(440, .06, .04, 'sine'); }

    /* ======= board generation ======= */
    function buildBoard() {
        pegs = []; slots = [];
        var mults = (TABLES[nRows] || TABLES[16])[risk];
        if (!mults) return;

        var topY = 60, botY = CH - SLOT_H - 24;
        var span = botY - topY;
        var boardW = CW * .84;

        for (var r = 0; r < nRows; r++) {
            var cnt = r + 3;
            var rowW = boardW * ((r + 3) / (nRows + 2));
            var gap = cnt > 1 ? rowW / (cnt - 1) : 0;
            var ox = (CW - rowW) / 2;
            for (var c = 0; c < cnt; c++) {
                pegs.push({ x: ox + c * gap, y: topY + r * (span / (nRows - 1)), glow: 0 });
            }
        }

        var bc = mults.length;
        var tw = boardW * 1.06;
        var sw = tw / bc;
        var sx = (CW - tw) / 2;
        var sy = CH - SLOT_H;
        for (var i = 0; i < bc; i++) {
            slots.push({
                x: sx + i * sw + 1, y: sy, w: sw - 2, h: SLOT_H,
                mult: mults[i], flash: 0,
                heat: Math.min(1, mults[i] / 8)
            });
        }
        draw();
    }

    /* ======= rendering ======= */
    function draw() {
        if (!ctx) return;
        var pal = RISK_PAL[risk];
        ctx.clearRect(0, 0, CW, CH);

        /* bg */
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, CW, CH);

        /* ambient glow */
        var rg = ctx.createRadialGradient(CW / 2, CH * .32, 0, CW / 2, CH * .32, CW * .55);
        rg.addColorStop(0, pal.bg + '0.04)');
        rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, CW, CH);

        /* faint grid */
        ctx.strokeStyle = 'rgba(255,255,255,.01)';
        ctx.lineWidth = 1;
        for (var gy = 40; gy < CH; gy += 50) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
        }

        /* drop indicator */
        var pulse = Math.sin(Date.now() * .003) * .3 + .7;
        ctx.globalAlpha = pulse * .5;
        var lg = ctx.createLinearGradient(CW / 2 - 40, 0, CW / 2 + 40, 0);
        lg.addColorStop(0, 'transparent'); lg.addColorStop(.5, pal.accent); lg.addColorStop(1, 'transparent');
        ctx.fillStyle = lg;
        ctx.fillRect(CW / 2 - 60, 0, 120, 3);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,' + pulse * .28 + ')';
        ctx.font = '600 10px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('▼  PRESS SPACE  ▼', CW / 2, 18);

        /* === slots === */
        for (var si = 0; si < slots.length; si++) {
            var s = slots[si];
            if (s.flash > 0) s.flash = Math.max(0, s.flash - .035);

            ctx.save();
            ctx.beginPath();
            rr(ctx, s.x, s.y + 2, s.w, s.h - 4, 5);

            /* slot fill */
            var fa = .06 + s.heat * .14 + s.flash * .55;
            ctx.fillStyle = pal.bg + fa + ')';
            ctx.fill();

            /* slot border on flash */
            if (s.flash > .05) {
                ctx.strokeStyle = pal.accent;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = s.flash;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
            ctx.restore();

            /* dividers */
            if (si < slots.length - 1) {
                ctx.beginPath();
                ctx.moveTo(s.x + s.w + 1, s.y + 6);
                ctx.lineTo(s.x + s.w + 1, s.y + s.h - 6);
                ctx.strokeStyle = 'rgba(255,255,255,.05)';
                ctx.lineWidth = 1; ctx.stroke();
            }

            /* mult label */
            var fs = s.w < 26 ? 7 : s.w < 34 ? 9 : 11;
            ctx.font = '700 ' + fs + 'px "Orbitron", sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;

            if (s.mult >= 20) { ctx.fillStyle = '#ffd740'; ctx.shadowColor = '#ffd740'; ctx.shadowBlur = 14 + s.flash * 24; }
            else if (s.mult >= 5) { ctx.fillStyle = '#b388ff'; ctx.shadowColor = '#b388ff'; ctx.shadowBlur = 6 + s.flash * 14; }
            else if (s.mult >= 1) { ctx.fillStyle = '#8e99a4'; ctx.shadowBlur = s.flash * 8; ctx.shadowColor = '#8e99a4'; }
            else { ctx.fillStyle = '#30304a'; }

            ctx.fillText(s.mult + '×', s.x + s.w / 2, s.y + s.h / 2);
            ctx.shadowBlur = 0;
        }

        /* === pegs === */
        for (var pi = 0; pi < pegs.length; pi++) {
            var p = pegs[pi];
            if (p.glow > 0) p.glow = Math.max(0, p.glow - .055);
            var pr = PEG_R + p.glow * 3;

            /* glow ring */
            if (p.glow > .08) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, pr + 12, 0, Math.PI * 2);
                var gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr + 12);
                gg.addColorStop(0, pal.glow);
                gg.addColorStop(1, 'transparent');
                ctx.globalAlpha = p.glow * .55;
                ctx.fillStyle = gg; ctx.fill();
                ctx.globalAlpha = 1;
            }

            /* peg body */
            ctx.beginPath();
            ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
            var pg = ctx.createRadialGradient(p.x - pr * .3, p.y - pr * .3, 0, p.x, p.y, pr);
            pg.addColorStop(0, '#fff');
            pg.addColorStop(.3, pal.peg);
            pg.addColorStop(1, pal.peg);
            ctx.globalAlpha = .4 + p.glow * .6;
            ctx.fillStyle = pg; ctx.fill();
            ctx.globalAlpha = 1;
        }

        /* === balls === */
        for (var bi = 0; bi < balls.length; bi++) {
            var b = balls[bi];
            if (!b.on && b.fade <= 0) continue;
            var ba = b.on ? 1 : b.fade;

            /* trail */
            for (var ti = 0; ti < b.trail.length; ti++) {
                var tt = b.trail[ti];
                var ta = (ti / b.trail.length) * .22 * ba;
                var ts = BALL_R * (ti / b.trail.length) * .6;
                ctx.beginPath(); ctx.arc(tt.x, tt.y, ts, 0, Math.PI * 2);
                ctx.fillStyle = pal.ball; ctx.globalAlpha = ta; ctx.fill();
            }
            ctx.globalAlpha = 1;

            /* outer aura */
            ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R * 4.5, 0, Math.PI * 2);
            var ag = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, BALL_R * 4.5);
            ag.addColorStop(0, pal.glow); ag.addColorStop(1, 'transparent');
            ctx.globalAlpha = .2 * ba; ctx.fillStyle = ag; ctx.fill();
            ctx.globalAlpha = 1;

            /* ball */
            ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
            var bg = ctx.createRadialGradient(b.x - BALL_R * .3, b.y - BALL_R * .3, 0, b.x, b.y, BALL_R);
            bg.addColorStop(0, '#fff'); bg.addColorStop(.35, pal.ball); bg.addColorStop(1, pal.accent);
            ctx.globalAlpha = ba; ctx.fillStyle = bg; ctx.fill();

            /* specular */
            ctx.beginPath(); ctx.arc(b.x - BALL_R * .25, b.y - BALL_R * .28, BALL_R * .3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.globalAlpha = ba * .5; ctx.fill();
            ctx.globalAlpha = 1;
        }

        /* === fx === */
        for (var fi = fx.length - 1; fi >= 0; fi--) {
            var f = fx[fi];
            f.x += f.vx; f.y += f.vy; f.vy += .055;
            f.life -= f.d;
            if (f.life <= 0) { fx.splice(fi, 1); continue; }
            ctx.save();
            ctx.globalAlpha = f.life * f.life;
            ctx.fillStyle = f.c;
            if (f.shape === 1) {
                ctx.translate(f.x, f.y);
                ctx.rotate(f.life * 6);
                ctx.fillRect(-f.s / 2, -f.s / 2, f.s * f.life, f.s * f.life);
            } else {
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.s * f.life, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    function rr(ctx, x, y, w, h, r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }

    function emitFX(x, y, color, n, isBig) {
        var cols = [color, '#fff', '#ffd740', '#b388ff', '#00e676', '#ff1744'];
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = 1.6 + Math.random() * (isBig ? 6.5 : 3.5);
            fx.push({
                x: x, y: y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.2,
                s: 2.0 + Math.random() * (isBig ? 4.5 : 2.5),
                c: cols[Math.floor(Math.random() * (isBig ? 6 : 3))],
                life: 1, d: .01 + Math.random() * .015,
                shape: isBig && Math.random() > .3 ? 1 : 0
            });
        }
    }

    /* ======= physics loop ======= */
    function step() {
        var alive = false;

        for (var i = 0; i < balls.length; i++) {
            var b = balls[i];
            if (!b.on) {
                if (b.fade > 0) { b.fade -= .022; alive = true; }
                continue;
            }
            alive = true;

            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 16) b.trail.shift();

            b.vy += G;
            b.x += b.vx;
            b.y += b.vy;

            /* dynamic walls */
            var prog = Math.max(0, Math.min(1, (b.y - 60) / (CH - SLOT_H - 84)));
            var fw = CW * .84 * ((3 + prog * nRows) / (nRows + 2));
            var lw = (CW - fw) / 2 - BALL_R;
            var rw = (CW + fw) / 2 + BALL_R;
            if (b.x < lw) { b.x = lw; b.vx = Math.abs(b.vx) * DAMP; }
            if (b.x > rw) { b.x = rw; b.vx = -Math.abs(b.vx) * DAMP; }

            if (b.serverData && slots[b.serverData.targetIndex]) {
                var targetSlot = slots[b.serverData.targetIndex];
                var targetX = targetSlot.x + targetSlot.w / 2;
                b.vx += (targetX - b.x) * 0.007 * prog;
            }

            /* peg collisions */
            for (var j = 0; j < pegs.length; j++) {
                var p = pegs[j];
                var dx = b.x - p.x, dy = b.y - p.y;
                var d2 = dx * dx + dy * dy;
                var minD = BALL_R + PEG_R;
                if (d2 < minD * minD) {
                    var d = Math.sqrt(d2) || .01;
                    var nx = dx / d, ny = dy / d;
                    b.x = p.x + nx * (minD + .5);
                    b.y = p.y + ny * (minD + .5);
                    var vn = b.vx * nx + b.vy * ny;
                    if (vn < 0) {
                        b.vx -= (1 + DAMP) * vn * nx;
                        b.vy -= (1 + DAMP) * vn * ny;
                        b.vx += (Math.random() - .5) * .75;
                        /* center bias = house edge */
                        b.vx += (CW / 2 - b.x) * .0015;
                    }
                    p.glow = 1.5;
                    sfxPeg();
                    break;
                }
            }

            /* speed cap */
            var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
            if (spd > MAX_V) { b.vx = b.vx / spd * MAX_V; b.vy = b.vy / spd * MAX_V; }

            /* slot landing */
            if (b.y + BALL_R >= CH - SLOT_H) {
                for (var k = 0; k < slots.length; k++) {
                    var s = slots[k];
                    if (b.x >= s.x && b.x <= s.x + s.w) {
                        if (b.serverData && slots[b.serverData.targetIndex]) {
                            s = slots[b.serverData.targetIndex];
                            b.x = s.x + s.w / 2;
                        }
                        b.on = false; b.fade = 1;
                        b.y = s.y + 14; s.flash = 1;
                        var big = s.mult >= 5;
                        emitFX(b.x, b.y, RISK_PAL[risk].ball, big ? 65 : 25, big);
                        land(s, b.serverData);
                        if (big) shakeCanvas();
                        break;
                    }
                }
                if (b.on && b.y > CH + 40) { b.on = false; b.fade = 0; land(null, b.serverData); }
            }
        }

        /* purge dead balls */
        for (var ci = balls.length - 1; ci >= 0; ci--) {
            if (!balls[ci].on && balls[ci].fade <= 0) balls.splice(ci, 1);
        }

        draw();

        if (alive || fx.length > 0 || balls.length > 0) {
            raf = requestAnimationFrame(step);
        } else {
            raf = null;
        }
    }
    function go() { if (!raf) raf = requestAnimationFrame(step); }

    function shakeCanvas() {
        if (!canvas) return;
        canvas.classList.remove('shake');
        void canvas.offsetWidth;           // force reflow
        canvas.classList.add('shake');
    }

    /* ======= landing logic ======= */
    function land(slot, serverData) {
        var mult = serverData ? serverData.multiplier : (slot ? slot.mult : 0);
        var win = serverData ? serverData.wonAmount : (slot ? Math.round(bet * mult) : 0);
        var prof = win - bet;

        stats.games++;
        if (prof >= 0) { stats.wins++; stats.totalWon += win; if (win > stats.maxWin) stats.maxWin = win; }
        else { stats.losses++; stats.totalLost += Math.abs(prof); }
        if (mult > stats.maxMult) stats.maxMult = mult;

        if (serverData && document.getElementById('balance')) {
            document.getElementById('balance').textContent = Math.round(serverData.newBalance);
            if (typeof window.syncBalance === 'function') setTimeout(window.syncBalance, 100);
        }
        ui();

        var rv = document.getElementById('result-value');
        var rc = document.getElementById('result-card');
        if (rv) {
            if (prof >= 0) {
                rv.textContent = '+' + win;
                rv.className = 'result-card-value win';
                if (rc) { rc.classList.add('glow-win'); rc.classList.remove('glow-lose'); }
                sfxWin(mult >= 5);
            } else {
                rv.textContent = '−' + Math.abs(prof);
                rv.className = 'result-card-value lose';
                if (rc) { rc.classList.add('glow-lose'); rc.classList.remove('glow-win'); }
                sfxLose();
            }
            setTimeout(function () { if (rc) rc.classList.remove('glow-win', 'glow-lose'); }, 600);
        }
        chip(mult, prof >= 0, prof >= 0 ? win : Math.abs(prof));
        saveStats();
    }

    /* ======= history tape ======= */
    function chip(mult, won, amt) {
        var bar = document.getElementById('history-bar');
        if (!bar) return;
        var el = document.createElement('div');
        el.className = 'tape-chip ' + (won ? 'w' : 'l');
        el.textContent = mult + '× ' + (won ? '+' : '−') + amt;
        bar.insertBefore(el, bar.firstChild);
        while (bar.children.length > 25) bar.removeChild(bar.lastChild);
    }

    /* ======= drop ======= */
    window.dropBall = async function () {
        ensureAudio();
        var bal = 0;
        if (typeof getBalanceSync === 'function') bal = getBalanceSync();
        if (bet > bal || bet <= 0) return;

        try {
            const token = localStorage.getItem('casinoToken') || '';
            const res = await fetch('/api/plinko/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ bet, rows: nRows, risk })
            });
            const data = await res.json();
            if (!data.success) {
                let errorMsg = data.error || 'Server Fehler';
                if (errorMsg === 'Insufficient balance') errorMsg = 'Nicht genügend Guthaben!';
                if(window.showMessage) window.showMessage(errorMsg, 'error');
                return;
            }

            if (document.getElementById('balance')) document.getElementById('balance').textContent = Math.round(data.newBalance - data.wonAmount);
            ui();
            spawn(data);
        } catch(e) {
            console.error(e);
        }
    };

    function spawn(serverData) {
        sfxDrop();
        balls.push({
            x: CW / 2 + (Math.random() - .5) * 18,
            y: 30,
            vx: (Math.random() - .5) * 1,
            vy: 0,
            on: true, fade: 1, trail: [],
            serverData: serverData
        });
        emitFX(CW / 2, 32, RISK_PAL[risk].ball, 5, false);
        go();
    }

    /* ======= auto ======= */
    window.toggleAuto = function () {
        autoMode = document.getElementById('auto-check').checked;
        if (autoMode) runAuto();
        else { clearInterval(autoTimer); autoTimer = null; }
    };
    function runAuto() {
        if (!autoMode) return;
        autoTimer = setInterval(function () {
            if (!autoMode) { clearInterval(autoTimer); autoTimer = null; return; }
            window.dropBall();
        }, 420);
    }

    /* ======= bet controls ======= */
    window.adjBet = function (d) { bet = Math.max(1, bet + d); document.getElementById('bet-input').value = bet; ui(); };
    window.setBet = function (v) { bet = Math.max(1, parseInt(v) || 100); document.getElementById('bet-input').value = bet; ui(); };
    window.halfBet = function () { bet = Math.max(1, Math.floor(bet / 2)); document.getElementById('bet-input').value = bet; ui(); };
    window.dblBet = function () { bet *= 2; document.getElementById('bet-input').value = bet; ui(); };
    window.maxBet = function () { bet = Math.floor(typeof getBalanceSync === 'function' ? getBalanceSync() : 1000); document.getElementById('bet-input').value = bet; ui(); };

    /* ======= settings ======= */
    window.setRisk = function (r) {
        risk = r;
        document.querySelectorAll('.risk-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-risk') === r);
        });
        buildBoard();
    };
    window.setRows = function (n) {
        nRows = n;
        document.querySelectorAll('.rows-btn').forEach(function (b) {
            b.classList.toggle('active', +b.getAttribute('data-rows') === n);
        });
        buildBoard();
    };

    /* ======= UI ======= */
    function ui() {
        var bal = typeof getBalanceSync === 'function' ? getBalanceSync() : 1000;
        var el;
        el = document.getElementById('balance'); if (el) el.textContent = Math.round(bal);
        el = document.getElementById('current-bet'); if (el) el.textContent = bet;
        el = document.getElementById('stat-games'); if (el) el.textContent = stats.games;
        el = document.getElementById('stat-wins'); if (el) el.textContent = stats.wins;
        el = document.getElementById('stat-profit');
        if (el) {
            el.textContent = (prof >= 0 ? '+' : '') + Math.round(prof);
            el.style.color = prof >= 0 ? '#00e676' : '#ff1744';
        }
        
        // Modal stats
        el = document.getElementById('stats-games'); if (el) el.textContent = stats.games;
        el = document.getElementById('stats-wins'); if (el) el.textContent = stats.wins;
        el = document.getElementById('stats-losses'); if (el) el.textContent = stats.losses;
        el = document.getElementById('stats-max-mult'); if (el) el.textContent = stats.maxMult + 'x';
        el = document.getElementById('stats-max-win'); if (el) el.textContent = Math.round(stats.maxWin);
        el = document.getElementById('stats-won'); if (el) el.textContent = Math.round(stats.totalWon);
        el = document.getElementById('stats-lost'); if (el) el.textContent = Math.round(stats.totalLost);
        el = document.getElementById('stats-balance'); if (el) el.textContent = Math.round(bal);
    }

    /* ======= stats persistence ======= */
    function saveStats() { try { localStorage.setItem('plinko_stats', JSON.stringify(stats)); } catch (e) { } }
    function loadStats() {
        try {
            var s = localStorage.getItem('plinko_stats');
            if (s) { var p = JSON.parse(s); for (var k in p) { if (stats.hasOwnProperty(k)) stats[k] = p[k]; } }
        } catch (e) { }
    }
    window.resetStats = function () {
        stats = { games: 0, wins: 0, losses: 0, totalWon: 0, totalLost: 0, maxMult: 0, maxWin: 0 };
        saveStats(); ui();
        var bar = document.getElementById('history-bar'); if (bar) bar.innerHTML = '';
        var rv = document.getElementById('result-value'); if (rv) { rv.textContent = '—'; rv.className = 'result-card-value'; }
    };

    /* compat stubs */
    window.showStatsModal = function () {
        var modal = document.getElementById('stats-modal-overlay');
        if (modal) modal.style.display = 'flex';
        ui();
    };
    window.hideStatsModal = function () {
        var modal = document.getElementById('stats-modal-overlay');
        if (modal) modal.style.display = 'none';
    };
    window.showMessage = function (msg, type) {
        var el = document.getElementById('game-message');
        if (el) {
            el.textContent = msg;
            el.className = 'game-message ' + (type || '');
            el.style.display = 'block';
            setTimeout(function() { el.style.display = 'none'; }, 3000);
        } else {
            alert(msg);
        }
    };
    window.setBalls = function () { };

    /* ======= init ======= */
    document.addEventListener('DOMContentLoaded', function () {
        canvas = document.getElementById('plinkoCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        canvas.width = CW;
        canvas.height = CH;
        canvas.style.width = CW + 'px';
        canvas.style.height = CH + 'px';

        loadStats();
        buildBoard();
        ui();

        // Task 20: Auto-adjust bet on load
        setTimeout(() => {
            if (typeof getBalanceSync === 'function') {
                const balance = getBalanceSync();
                if (balance < bet) {
                    bet = balance;
                    if (bet < 1) bet = 1;
                    document.getElementById('bet-input').value = bet;
                    ui();
                }
            }
        }, 100);

        document.addEventListener('keydown', function (e) {
            if (e.code === 'Space') { e.preventDefault(); window.dropBall(); }
        });
        canvas.addEventListener('click', function () { window.dropBall(); });
    });

    setTimeout(function () {
        if (typeof syncBalance === 'function') syncBalance();
        ui();
    }, 80);
})();
