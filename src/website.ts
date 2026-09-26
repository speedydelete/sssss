
import {identifyPeriodic, parseSpeed, speedToString, parse} from '../lifeweb/lib/index.js';
import {Rulespace, RULESPACE_NAMES, B0_RULESPACES, RANGES, isPartOfRulespace, Ship, shipsToString, normalizeShips, isValidInRulespace, getOptimalPop} from './base.js';


const API_PATH = `http://localhost:3000`;
// const API_PATH = `api`;

function getElement<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap>(id: string, type?: T): HTMLElementTagNameMap[T] {
    let out = document.getElementById(id);
    if (!out) {
        throw new Error(`Missing element: '${id}'`);
    }
    if (type !== undefined) {
        let tag = out.tagName.toLowerCase();
        if (tag !== type) {
            throw new Error(`Element '${id}' is required to be of type '${type}' but is type '${tag}'`);
        }
    }
    return out as HTMLElementTagNameMap[T];
}


function parseShips(data: string): Ship[] {
    let out = [];
    if (data.match((/x\s*=\s*\d+\s*,?\s*y\s*=\s*\d+\s*,?\s*(?:rule\s*=\s*(.*))/))) {
        let currentRLE = '';
        let rleNumber = 0;
        let isFirstLine = false;
        for (let line of data.split('\n')) {
            line = line.trim();
            if (line === '' || line.startsWith('#')) {
                continue;
            }
            if (line.startsWith('x')) {
                if (currentRLE !== '') {
                    let p = parse(currentRLE);
                    let type = identifyPeriodic(p, 65536, false);
                    if (!type.disp) {
                        alert(`Pattern #${rleNumber} is not a spaceship or its period is higher than 65536!`);
                    } else {
                        out.push({
                            pop: 0,
                            rule: p.rule.str,
                            dx: type.disp[0],
                            dy: type.disp[1],
                            period: type.period,
                            rle: p.toRLE().split('\n').slice(1).join(''),
                        });
                    }
                }
                currentRLE = line + '\n';
                rleNumber++;
            } else if (isFirstLine) {
                alert('First line must be a RLE header!');
            } else {
                currentRLE += line + '\n';
            }
        }
        if (currentRLE !== '') {
            let p = parse(currentRLE);
            let type = identifyPeriodic(p, 65536);
            p.run(type.stabilizedAt);
            if (!type.disp) {
                alert(`Pattern #${rleNumber} is not a spaceship or its period is higher than 65536!`);
            } else {
                out.push({
                    pop: 0,
                    rule: p.rule.str,
                    dx: type.disp[0],
                    dy: type.disp[1],
                    period: type.period,
                    rle: p.toRLE().split('\n').slice(1).join(''),
                });
            }
        }
    } else {
        for (let line of data.split('\n')) {
            line = line.trim();
            if (line === '' || line.startsWith('#')) {
                continue;
            }
            let info = line.split(', ');
            out.push({
                pop: parseInt(info[0]),
                rule: info[1],
                dx: parseInt(info[2]),
                dy: parseInt(info[3]),
                period: parseInt(info[4]),
                rle: info[5],
            });
        }
    }
    return out;
}


let rulespaceSelect = getElement('rulespace', 'select');
let space = rulespaceSelect.value as Rulespace;
rulespaceSelect.addEventListener('change', () => {
    space = rulespaceSelect.value as Rulespace;
});

let countsOutput = getElement('counts');

async function getCounts() {
    let resp = await fetch(`${API_PATH}/getcounts?rulespace=${space}`);
    if (resp.ok) {
        countsOutput.textContent = await resp.text();
    } else {
        countsOutput.textContent = '';
        if (resp.status === 429) {
            setTimeout(async () => {
                let resp = await fetch(`${API_PATH}/getcounts?rulespace=${space}`);
                if (resp.ok) {
                    countsOutput.textContent = await resp.text();
                }
            }, 600);
        }
    }
}

rulespaceSelect.addEventListener('change', getCounts);


let periodMapsShown = false;

let mainElt = getElement('main');
let periodMapsElt = getElement('period-maps');
let periodMapsButton = getElement('period-maps-button');

periodMapsButton.addEventListener('click', () => {
    if (periodMapsShown) {
        periodMapsShown = false;
        mainElt.style.display = 'flex';
        periodMapsElt.style.display = 'none';
        periodMapsButton.textContent= 'Period maps';
    } else {
        periodMapsShown = true;
        mainElt.style.display = 'none';
        periodMapsElt.style.display = 'flex';
        periodMapsButton.textContent= 'Back';
        fetchPeriodMap();
    }
});


let speedInput = getElement('speed', 'input');
let adjustablesSelect = getElement('adjustables', 'select');
let searchButton = getElement('search');
let searchOutput = getElement('out');

searchButton.addEventListener('click', async () => {
    let data = parseSpeed(speedInput.value);
    if (!data) {
        return;
    }
    let {dx, dy, period} = data;
    let resp = await fetch(`${API_PATH}/get?rulespace=${space}&dx=${dx}&dy=${dy}&period=${period}&adjustables=${adjustablesSelect.value}`);
    if (resp.ok) {
        searchOutput.textContent = await resp.text();
    } else {
        if (resp.status === 429) {
            alert('You are being rate limited! Try again!');
        } else {
            alert(`Error: Server returned ${resp.status} ${resp.statusText}!`);
        }
    }
});


let isBackButton = false;

let shipsInput = getElement('ships', 'textarea');
let shipsOutput = getElement('ships-out');
let submitButton = getElement('submit');

submitButton.addEventListener('click', async () => {
    if (isBackButton) {
        shipsInput.style.display = 'block';
        shipsOutput.style.display = 'none';
        submitButton.textContent = 'Submit';
        isBackButton = false;
        return;
    }
    let rawShips = parseShips(shipsInput.value);
    if (rawShips.length === 0) {
        alert(`No ships provided or all ships are invalid!`);
        return;
    }
    let [ships, invalidShips] = normalizeShips(space, rawShips, false, 65536);
    if (ships.length === 0) {
        alert(`No ships provided or all ships are invalid!`);
        return;
    }
    ships = ships.filter(x => x);
    for (let ship of ships) {
        if (!isValidInRulespace(space, ship)) {
            alert(`Invalid ship for rulespace ${RULESPACE_NAMES[space]}: ${shipsToString([ship])}`);
            return;
        }
    }
    shipsInput.style.display = 'none';
    shipsOutput.style.display = 'block';
    shipsOutput.textContent = 'Adding ships...';
    submitButton.textContent = 'Back';
    isBackButton = true;
    let resp = await fetch(`${API_PATH}/add?rulespace=${space}`, {
        method: 'POST',
        body: shipsToString(ships),
    });
    if (resp.ok) {
        shipsInput.style.display = 'none';
        shipsOutput.style.display = 'block';
        submitButton.textContent = 'Back';
        let out = await resp.text();
        if (invalidShips.length > 0) {
            out = `${invalidShips.length} invalid ships removed before submitting: ${invalidShips.join(', ')}\n${out}`;
        }
        shipsOutput.textContent = out;
        isBackButton = true;
    } else {
        if (resp.status === 429) {
            shipsInput.style.display = 'block';
            shipsOutput.style.display = 'none';
            submitButton.textContent = 'Submit';
            isBackButton = false;
            alert('You are being rate limited! Try again in 5 seconds!');
        } else {
            shipsOutput.textContent = `Error: Server returned ${resp.status} ${resp.statusText}!`;
        }
    }
});


let mapCache: {[key: string]: Uint32Array} = {};
let prevHour = 0

let periodMapSettingsWrapperElt = getElement('period-map-settings-wrapper');
let periodMapPeriodElt = getElement('period-map-period', 'input');
let periodMapAdjustablesSelect = getElement('period-map-adjustables', 'select');
let mapCanvas = getElement('period-map-map', 'canvas');
let mapCtx = mapCanvas.getContext('2d') as CanvasRenderingContext2D;
let mapHoverInfoElt = getElement('period-map-hover-info');

let period = 0;
let periodMap: Uint32Array | undefined = undefined;
let mapCellCount = 0;
let mapSize = 0;
let mapCellSize = 0;

async function fetchPeriodMap(): Promise<void> {
    if (!periodMapsShown) {
        return;
    }
    let newPeriod = parseInt(periodMapPeriodElt.value);
    let adjustables = periodMapAdjustablesSelect.value;
    if (B0_RULESPACES.includes(space)) {
        if (newPeriod % 2 !== 0) {
            newPeriod--;
        }
        periodMapPeriodElt.min = '2';
        periodMapPeriodElt.max = '126';
        periodMapPeriodElt.step = '2';
        periodMapPeriodElt.value = String(newPeriod);
    } else {
        periodMapPeriodElt.min = '1';
        periodMapPeriodElt.max = '127';
        periodMapPeriodElt.step = '1';
    }
    let hour = Math.floor((Date.now() / 1000) / 3600);
    if (hour > prevHour) {
        mapCache = {};
    }
    prevHour = hour;
    let key = space + ' ' + newPeriod + ' ' + adjustables;
    if (key in mapCache) {
        periodMap = mapCache[key];
    } else {
        let resp = await fetch(`${API_PATH}/getperiodmap?rulespace=${space}&period=${newPeriod}&adjustables=${adjustables}`);
        if (!resp.ok) {
            alert(`Server returned ${resp.status} ${resp.statusText} while fetching period map`);
            return;
        }
        periodMap = new Uint32Array(await resp.arrayBuffer());
        mapCache[key] = periodMap;
    }
    period = newPeriod;
    let rect = periodMapsElt.getBoundingClientRect();
    let rect2 = periodMapSettingsWrapperElt.getBoundingClientRect();
    let rect3 = mapHoverInfoElt.getBoundingClientRect();
    // subtract 40 for the gap property
    let height = rect.height - rect2.height - rect3.height - 40;
    mapCellCount = RANGES[space] * period + 1;
    mapSize = Math.min(mapCellCount * 32, height);
    mapCellSize = Math.floor(mapSize / mapCellCount);
    mapSize = mapCellSize * mapCellCount;
    mapCanvas.width = mapSize;
    mapCanvas.height = mapSize;
}

periodMapPeriodElt.addEventListener('change', fetchPeriodMap);
rulespaceSelect.addEventListener('change', fetchPeriodMap);
periodMapAdjustablesSelect.addEventListener('change', fetchPeriodMap);

let mouseX: number | undefined = undefined;
let mouseY: number | undefined = undefined;

function updateCanvasCoords(event: MouseEvent): void {
    let rect = mapCanvas.getBoundingClientRect();
    mouseX = event.clientX - rect.x;
    mouseY = event.clientY - rect.y;
}

mapCanvas.addEventListener('mouseenter', updateCanvasCoords);
mapCanvas.addEventListener('mousemove', updateCanvasCoords);

mapCanvas.addEventListener('mouseleave', () => {
    mouseX = undefined;
    mouseY = undefined;
});

function renderPeriodMap(): void {
    if (periodMapsElt.style.display === 'none' || periodMap === undefined) {
        requestAnimationFrame(renderPeriodMap);
        return;
    }
    mapCtx.fillStyle = '#000000';
    mapCtx.fillRect(0, 0, mapSize, mapSize);
    type LineColor = '#0000ff' | '#007fff' | '#00ffff';
    let lines: {[K in LineColor]: Set<string>} = {
        '#00ffff': new Set(),
        '#007fff': new Set(),
        '#0000ff': new Set(),
    };
    let hover: [number, number] | undefined = undefined;
    let periodMapIndex = 0;
    for (let x = 0; x <= mapCellCount; x++) {
        for (let y = 0; y <= x; y++) {
            let pop = periodMap[periodMapIndex];
            periodMapIndex++;
            // population 0 means it's unknown
            let unknown = pop === 0;
            let possible = true;
            let isOptimal = false;
            let provenOptimal = false;
            let optimalPop = getOptimalPop(space, x, y, period);
            if (optimalPop === false) {
                possible = false;
                mapCtx.fillStyle = '#3f3f3f';
            } else if (unknown) {
                mapCtx.fillStyle = '#000000';
            } else {
                let diff = pop - optimalPop;
                if (diff <= 0) {
                    mapCtx.fillStyle = '#00ff00';
                    isOptimal = true;
                } else if (diff <= 2) {
                    mapCtx.fillStyle = '#ffff00';
                } else if (diff <= 4) {
                    mapCtx.fillStyle = '#ffd200';
                } else {
                    mapCtx.fillStyle = '#ffa500';
                }
            }
            let cx = x * mapCellSize;
            let cy = y * mapCellSize;
            mapCtx.fillRect(cx, cy, mapCellSize, mapCellSize);
            mapCtx.fillRect(cy, cx, mapCellSize, mapCellSize);
            if (possible) {
                lines['#0000ff'].add(`${x} ${y}`);
                lines['#0000ff'].add(`${y} ${x}`);
                if (isPartOfRulespace(space, 'int')) {
                    if (period >= 2*Math.max(x, y) + Math.min(x, y)) {
                        lines['#007fff'].add(`${x} ${y}`);
                        lines['#007fff'].add(`${y} ${x}`);
                        if (period >= 2*(x + y)) {
                            lines['#00ffff'].add(`${x} ${y}`);
                            lines['#00ffff'].add(`${y} ${x}`);
                        }
                    }
                }
            }
            if (mouseX !== undefined && mouseY !== undefined) {
                let text = `${speedToString(x, y, period)}, `;
                if (!possible) {
                    text += 'impossible';
                } else if (unknown) {
                    text += 'unknown';
                } else {
                    text += `population ${pop}, `;
                    if (provenOptimal) {
                        text += 'proven optimal';
                    } else if (isOptimal) {
                        text += 'optimal';
                    } else {
                        text += `not optimal (optimal is ${getOptimalPop(space, x, y, period)} cells)`;
                    }
                }
                if (mouseX >= cx && mouseY >= cy && mouseX < cx + mapCellSize && mouseY < cy + mapCellSize) {
                    mapHoverInfoElt.textContent = text;
                    hover = [cx, cy];
                } else if (mouseX >= cy && mouseY >= cx && mouseX < cy + mapCellSize && mouseY < cx + mapCellSize) {
                    mapHoverInfoElt.textContent = text;
                    hover = [cy, cx];
                }
            }
        }
    }
    for (let [color, cells] of Object.entries(lines)) {
        mapCtx.fillStyle = color;
        for (let x = 0; x <= mapCellCount; x++) {
            for (let y = 0; y <= mapCellCount; y++) {
                let cx = x * mapCellSize;
                let cy = y * mapCellSize;
                if (cells.has(`${x} ${y}`)) {
                    // top
                    if (y > 0 && !cells.has(`${x} ${y - 1}`)) {
                        mapCtx.fillRect(cx - 1, cy - 1, mapCellSize + 2, 2);
                    }
                    // bottom
                    if (y < mapCellCount - 1 && !cells.has(`${x} ${y + 1}`)) {
                        mapCtx.fillRect(cx - 1, cy + mapCellSize - 1, mapCellSize + 2, 2);
                    }
                    // left
                    if (x > 0 && !cells.has(`${x - 1} ${y}`)) {
                        mapCtx.fillRect(cx - 1, cy - 1, 2, mapCellSize + 2);
                    }
                    // right
                    if (x < mapCellCount - 1 && !cells.has(`${x + 1} ${y}`)) {
                        mapCtx.fillRect(cx + mapCellSize - 1, cy - 1, 2, mapCellSize + 2);
                    }
                }
            }
        }
    }
    if (hover) {
        let [cx, cy] = hover;
        mapCtx.fillStyle = '#ff00ff';
        mapCtx.fillRect(cx, cy, mapCellSize, 2);
        mapCtx.fillRect(cx, cy, 2, mapCellSize);
        mapCtx.fillRect(cx, cy + mapCellSize - 2, mapCellSize, 2);
        mapCtx.fillRect(cx + mapCellSize - 2, cy, 2, mapCellSize);
    }
    if (mouseX === undefined && mouseY === undefined) {
        mapHoverInfoElt.textContent = '';
    }
    requestAnimationFrame(renderPeriodMap);
}

requestAnimationFrame(renderPeriodMap);


for (let type of ['input', 'textarea', 'select']) {
    document.querySelectorAll(type).forEach(elt => {
        let key = '5s-' + type + '-' + elt.id;
        let value = localStorage[key];
        if (value) {
            (elt as HTMLInputElement).value = value;
        }
        elt.addEventListener('change', () => {
            localStorage[key] = (elt as HTMLInputElement).value;
        });
    });
}


space = rulespaceSelect.value as Rulespace;
getCounts();
