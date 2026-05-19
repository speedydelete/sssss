
import {parseSpeed, speedToString} from '../lifeweb/lib/index.js';
import {Type, parseShips, shipsToString, normalizeShips, isValidInType, speedIsPossible, getOptimalPop} from './base.js';

// const API_PATH = `http://localhost:3000`;
const API_PATH = `api`;

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


let typeSelect = getElement('type', 'select');

let countsOutput = getElement('counts');

async function getCounts() {
    let resp = await fetch(`${API_PATH}/getcounts?type=${typeSelect.value}`);
    if (resp.ok) {
        countsOutput.textContent = await resp.text();
    } else {
        countsOutput.textContent = '';
        if (resp.status === 429) {
            setTimeout(async () => {
                let resp = await fetch(`${API_PATH}/getcounts?type=${typeSelect.value}`);
                if (resp.ok) {
                    countsOutput.textContent = await resp.text();
                }
            }, 600);
        }
    }
}

typeSelect.addEventListener('change', getCounts);


let mainElt = getElement('main');
let periodMapsElt = getElement('period-maps');
let periodMapsButton = getElement('period-maps-button');

periodMapsButton.addEventListener('click', () => {
    if (periodMapsElt.style.display === 'none') {
        mainElt.style.display = 'none';
        periodMapsElt.style.display = 'flex';
        periodMapsButton.textContent= 'Back';
    } else {
        mainElt.style.display = 'flex';
        periodMapsElt.style.display = 'none';
        periodMapsButton.textContent= 'Period maps';
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
    let resp = await fetch(`${API_PATH}/get?type=${typeSelect.value}&dx=${dx}&dy=${dy}&period=${period}&adjustables=${adjustablesSelect.value}`);
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
    let type = typeSelect.value as Type;
    let rawShips = parseShips(shipsInput.value);
    if (rawShips.length === 0) {
        alert(`No ships provided or all ships are invalid!`);
        return;
    }
    let [ships, invalidShips] = normalizeShips(type, rawShips, false, 65536);
    if (ships.length === 0) {
        alert(`No ships provided or all ships are invalid!`);
        return;
    }
    ships = ships.filter(x => x);
    for (let ship of ships) {
        if (!isValidInType(type, ship)) {
            alert(`Invalid ship: ${shipsToString([ship])}`);
            return;
        }
    }
    shipsInput.style.display = 'none';
    shipsOutput.style.display = 'block';
    shipsOutput.textContent = 'Adding ships...';
    submitButton.textContent = 'Back';
    isBackButton = true;
    let resp = await fetch(`${API_PATH}/add?type=${typeSelect.value}`, {
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


let periodElt = getElement('period', 'input');
let mapCanvas = getElement('period-map', 'canvas');
let mapCtx = mapCanvas.getContext('2d') as CanvasRenderingContext2D; 

let period = 0;
let periodMap: Uint32Array | undefined = undefined;
let mapCellCount = 0;
let mapSize = 0;
let mapCellSize = 0;

async function fetchPeriodMap(): Promise<void> {
    let type = typeSelect.value;
    let newPeriod = parseInt(periodElt.value);
    let resp = await fetch(`${API_PATH}/getperiodmap?type=${type}&period=${newPeriod}`);
    if (!resp.ok) {
        alert(`Server returned ${resp.status} ${resp.statusText} while fetching period map`);
        return;
    }
    let b0 = type.includes('b0');
    periodMap = new Uint32Array(await resp.arrayBuffer());
    period = newPeriod;
    let rect = periodMapsElt.getBoundingClientRect();
    mapCellCount = b0 ? Math.floor(period / 2 * 3 / 2) + 1 : period + 1;
    mapSize = Math.min(mapCellCount * 32, rect.height - 100);
    mapCellSize = Math.floor(mapSize / mapCellCount);
    mapSize = mapCellSize * mapCellCount;
    mapCanvas.width = mapSize;
    mapCanvas.height = mapSize;
    console.log(periodMap);
}

periodElt.addEventListener('change', fetchPeriodMap);
typeSelect.addEventListener('change', fetchPeriodMap);

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

let mapHoverInfoElt = getElement('period-map-hover-info');

function renderPeriodMap(): void {
    if (periodMapsElt.style.display === 'none' || periodMap === undefined) {
        requestAnimationFrame(renderPeriodMap);
        return;   
    }
    let type = typeSelect.value as Type;
    mapCtx.fillStyle = '#000000';
    mapCtx.fillRect(0, 0, mapSize, mapSize);
    let i = 0;
    for (let dx = 0; dx <= mapCellCount; dx++) {
        for (let dy = 0; dy <= dx; dy++) {
            let value = periodMap[i++];
            let possible = true;
            let isOptimal = false;
            let provenOptimal = false;
            if (value & (1 << 31)) {
                mapCtx.fillStyle = '#00ff00';
                value &= ~(1 << 31);
                provenOptimal = true;
                isOptimal = true;
            } else if (!speedIsPossible(type, dx, dy, period)) {
                mapCtx.fillStyle = '#000000';
                possible = false;
            } else if (value === 0) {
                mapCtx.fillStyle = '#000000';
            } else {
                let optimal = getOptimalPop(type, dx, dy, period);
                let value2 = value - optimal;
                if (value2 <= 0) {
                    mapCtx.fillStyle = '#00ff00';
                    isOptimal = true;
                } else if (value2 <= 2) {
                    mapCtx.fillStyle = '#ffff00';
                } else if (value2 <= 4) {
                    mapCtx.fillStyle = '#ffd200';
                } else {
                    mapCtx.fillStyle = '#ffa500';
                }
            }
            let x = dx * mapCellSize;
            let y = dy * mapCellSize;
            mapCtx.fillRect(x, y, mapCellSize, mapCellSize);
            mapCtx.fillRect(y, x, mapCellSize, mapCellSize);
            if (possible && !speedIsPossible(type, dx + 1, dy, period)) {
                mapCtx.fillStyle = '#0000ff';
                mapCtx.fillRect(x, y + mapCellSize - 2, mapCellSize, 2);
                mapCtx.fillRect(y + mapCellSize - 2, x - 2, 2, mapCellSize + 2);
                if (dx !== mapCellCount - 1) {
                    mapCtx.fillRect(y, x + mapCellSize - 2, mapCellSize, 2);
                    mapCtx.fillRect(x + mapCellSize - 2, y - 2, 2, mapCellSize + 2);
                }
            }
            if (mouseX !== undefined && mouseY !== undefined) {
                if (mouseX >= x && mouseY >= y && mouseX < x + mapCellSize && mouseY < y + mapCellSize) {
                    let text = `${speedToString(dx, dy, period)}, `;
                    if (!possible) {
                        text += 'impossible';
                    } else if (value === 0) {
                        text += 'unknown';
                    } else {
                        text += `population ${value}, `;
                        if (provenOptimal) {
                            text += 'proven optimal';
                        } else if (isOptimal) {
                            text += 'optimal';
                        } else {
                            text += `not optimal (optimal is ${getOptimalPop(type, dx, dy, period)} cells)`;
                        }
                    }
                    mapHoverInfoElt.textContent = text;
                    mapCtx.fillStyle = '#ff00ff';
                    mapCtx.fillRect(x, y, mapCellSize, 2);
                    mapCtx.fillRect(x, y, 2, mapCellSize);
                    mapCtx.fillRect(x, y + mapCellSize - 2, mapCellSize, 2);
                    mapCtx.fillRect(x + mapCellSize - 2, y, 2, mapCellSize);
                } else if (mouseX >= y && mouseY >= x && mouseX <= y + mapCellSize && mouseY <= x + mapCellSize) {
                    let text = `${speedToString(dx, dy, period)}, `;
                    if (!possible) {
                        text += 'impossible';
                    } else if (value === 0) {
                        text += 'unknown';
                    } else {
                        text += `population ${value}, `;
                        if (provenOptimal) {
                            text += 'proven optimal';
                        } else if (isOptimal) {
                            text += 'optimal';
                        } else {
                            text += `not optimal (optimal is ${getOptimalPop(type, dx, dy, period)} cells)`;
                        }
                    }
                    mapHoverInfoElt.textContent = text;
                    mapCtx.fillStyle = '#ff00ff';
                    mapCtx.fillRect(y, x, mapCellSize, 2);
                    mapCtx.fillRect(y, x, 2, mapCellSize);
                    mapCtx.fillRect(y, x + mapCellSize - 2, mapCellSize, 2);
                    mapCtx.fillRect(y + mapCellSize - 2, x, 2, mapCellSize);
                }
            }
        }
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

getCounts();
