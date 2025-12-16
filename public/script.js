const SERVER_URL = "http://15.134.86.182:3000";
const socket = io(SERVER_URL);
const canvas = new fabric.Canvas('c');

canvas.backgroundColor = '#ffffff';
canvas.selection = false;

const colorList = [
    '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA',
    '#FF6B6B', '#4DABF7', '#FFD43B', '#69DB7C', '#FCC2D7'
];
let currentSelectedColor = colorList[0];

// 지역별 도형 데이터
const districtShapes = {
    'eojindong': ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
    'dodam': ['F1', 'F2', 'F3', 'F8', 'F9', 'F10', 'F11'],
    'areum': ['F1', 'F2', 'F3', 'F12', 'F13', 'F14', 'F15'],
    'hamildong': ['F1', 'F2', 'F3', 'F16', 'F17', 'F18', 'F19'],
    'naseongdong': ['F1', 'F2', 'F3', 'F20', 'F21', 'F22', 'F23'],
    'bangok_jiphyeon': ['F1', 'F2', 'F3', 'F24', 'F25', 'F26', 'F27'],
    'jochiwon': ['F1', 'F2', 'F3', 'F28', 'F29', 'F30', 'F31'],
    'jeonui_myeon': ['F1', 'F2', 'F3', 'F15', 'F30', 'F32', 'F33'],
    'yeonseomyeon': ['F1', 'F2', 'F3', 'F6', 'F8', 'F13', 'F34'],
    'bugangmyeon': ['F1', 'F2', 'F3', 'F35', 'F36', 'F37', 'F38'],
    'geumnammyeon': ['F1', 'F2', 'F3', 'F14', 'F26', 'F36', 'F39'],
    'yeongimyeon': ['F1', 'F2', 'F3', 'F32', 'F40', 'F41', 'F42'],
    'janggunmyeon': ['F1', 'F2', 'F3', 'F13', 'F43', 'F44', 'F45'],
    'yeondongmyeon': ['F1', 'F2', 'F3', 'F22', 'F36', 'F44', 'F46'],
    'otherarea': ['F1', 'F2', 'F3', 'F11', 'F35', 'F47', 'F48']
};

/* --- 유틸리티 함수 --- */
function colorizeSvgText(svgText, color) {
    let newSvgText = svgText;
    newSvgText = newSvgText.replace(/fill\s*=\s*("|')([^"']+)("|')/gi, (match, p1, p2, p3) => {
        if (p2.toLowerCase() !== 'none') { return `fill=${p1}${color}${p3}`; } return match;
    });
    newSvgText = newSvgText.replace(/stroke\s*=\s*("|')([^"']+)("|')/gi, (match, p1, p2, p3) => {
        if (p2.toLowerCase() !== 'none') { return `stroke=${p1}${color}${p3}`; } return match;
    });
    newSvgText = newSvgText.replace(/style\s*=\s*("|')([^"']*)fill:\s*([^;]+)([^"']*)("|')/gi, (match, p1, p2, p3, p4, p5) => {
        return `style=${p1}${p2}fill: ${color}${p4}${p5}`;
    });
    return newSvgText;
}

function applyColorToSvg(loadedObj, color) {
    let colorApplied = false;
    if (loadedObj.isType('group')) {
        loadedObj.getObjects().forEach(obj => {
            if (obj.fill && obj.fill !== 'none') { obj.set('fill', color); colorApplied = true; }
            if (obj.stroke && obj.stroke !== 'none') { obj.set('stroke', color); colorApplied = true; }
        });
    }
    if (!colorApplied || !loadedObj.getObjects || loadedObj.getObjects().length === 0) {
        if (loadedObj.fill && loadedObj.fill !== 'none') { loadedObj.set('fill', color); } else { loadedObj.set('fill', color); }
    }
}

/* 🌟 [수정] 조각 타입을 나누지 않고 모두 'Flower'로 통일 */
function assignComponentType(index, totalCount) {
    return "Flower"; 
}

/* --- 초기화 및 팔레트 생성 --- */
function initColorPalette() {
    const colorContainer = document.getElementById('color-palette');
    colorContainer.innerHTML = '';
    colorList.forEach((color, index) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = color;
        if (index === 0) btn.classList.add('active');
        btn.onclick = () => selectColor(btn, color);
        colorContainer.appendChild(btn);
    });
}

function selectColor(btnElement, color) {
    currentSelectedColor = color;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        applyColorToSvg(activeObject, color);
        activeObject.set('userColor', color);
        canvas.renderAll();
    }
    updatePaletteSvgColors(color);
}

function updatePaletteSvgColors(color) {
    document.querySelectorAll('.shape-btn').forEach(btn => {
        const originalSvg = btn.getAttribute('data-original-svg');
        if (originalSvg) {
            btn.innerHTML = colorizeSvgText(originalSvg, color);
        }
    });
}

/* 🌟 [수정] 파일 로드 실패 시 에러 처리 강화 */
async function generatePalette(districtCode) {
    const flowerDiv = document.getElementById('flower-palette-container');
    flowerDiv.innerHTML = '';

    const shapeNames = districtShapes[districtCode] || [];

    const loadedSvgs = await Promise.all(shapeNames.map(shapeName => 
        fetch(`assets/${shapeName}.svg`)
            .then(res => {
                if(!res.ok) throw new Error("File not found");
                return res.text();
            })
            .then(svgText => ({ shapeName, svgText, error: false }))
            .catch(() => ({ 
                shapeName, 
                svgText: `<svg viewBox="0 0 50 50"><text y="25" fill="red" font-size="10">${shapeName}</text></svg>`,
                error: true 
            }))
    ));

    const totalCount = loadedSvgs.length;
    loadedSvgs.forEach(({ shapeName, svgText, error }, index) => {
        const type = assignComponentType(index, totalCount);
        const btn = createPaletteButton(shapeName, svgText, type);
        if(error) btn.style.border = "1px solid red"; // 파일 없으면 빨간 테두리
        flowerDiv.appendChild(btn);
    });
}

function createPaletteButton(shapeName, svgText, componentType) {
    const btn = document.createElement('div');
    btn.className = 'shape-btn';
    btn.setAttribute('data-original-svg', svgText);
    btn.innerHTML = colorizeSvgText(svgText, currentSelectedColor);
    btn.setAttribute('draggable', true);

    btn.addEventListener('dragstart', (e) => {
        const data = { type: shapeName, color: currentSelectedColor, componentType: componentType };
        e.dataTransfer.setData('shapeData', JSON.stringify(data));
    });

    btn.onclick = () => {
        const center = canvas.getCenter();
        addShapeAtPosition({ type: shapeName, color: currentSelectedColor, componentType: componentType }, center.left, center.top);
    };

    return btn;
}

/* --- 화면 전환 --- */
function goToStep2() {
    const username = document.getElementById('username').value.trim();
    const district = document.getElementById('district-select').value;
    if (!username || !district) { alert("이름과 동네를 모두 입력해주세요!"); return; }

    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');

    resizeCanvas();
    initColorPalette();
    generatePalette(district);
}

function resizeCanvas() {
    const wrapper = document.querySelector('.canvas-wrapper');
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight || width;
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.renderAll();
}
window.addEventListener('resize', resizeCanvas);

/* --- 드래그 앤 드롭 --- */
const canvasContainer = document.querySelector('.canvas-wrapper');
canvasContainer.addEventListener('dragover', e => { e.preventDefault(); canvasContainer.classList.add('drag-over'); });
canvasContainer.addEventListener('dragleave', () => canvasContainer.classList.remove('drag-over'));
canvasContainer.addEventListener('drop', e => {
    e.preventDefault();
    canvasContainer.classList.remove('drag-over');
    const jsonStr = e.dataTransfer.getData('shapeData');
    if (jsonStr) {
        const data = JSON.parse(jsonStr);
        const rect = canvas.getElement().getBoundingClientRect();
        addShapeAtPosition(data, e.clientX - rect.left, e.clientY - rect.top);
    }
});

/* 🌟 [핵심 수정] SVG 크기 자동 조절 (Huge Box 버그 해결) */
function addShapeAtPosition(data, x, y) {
    const svgPath = `assets/${data.type}.svg`;

    fabric.loadSVGFromURL(svgPath, (objects, options) => {
        const loadedObj = fabric.util.groupSVGElements(objects, options);
        applyColorToSvg(loadedObj, data.color);

        // 크기 정규화 (무조건 적당한 크기 100px로 줄임)
        const originalWidth = loadedObj.width || 100;
        const originalHeight = loadedObj.height || 100;
        const targetSize = 100;
        const scaleFactor = targetSize / Math.max(originalWidth, originalHeight);

        loadedObj.set({
            left: x, top: y, originX: 'center', originY: 'center',
            hasControls: true, hasBorders: true,
            lockScalingX: false, lockScalingY: false, lockRotation: false, lockUniScaling: true,
            
            // 컨트롤 디자인
            cornerColor: 'rgba(0,0,0,0.5)', cornerStrokeColor: '#fff', borderColor: '#333',
            cornerSize: 12, padding: 5, transparentCorners: false,
            
            perPixelTargetFind: true
        });

        loadedObj.set('componentType', data.componentType);
        loadedObj.set('type', data.type);
        loadedObj.set('userColor', data.color);

        canvas.add(loadedObj);
        canvas.bringToFront(loadedObj);
        canvas.setActiveObject(loadedObj);
        
        // 등장 효과 (계산된 스케일까지만 커짐)
        loadedObj.set({ scaleX: 0, scaleY: 0 });
        loadedObj.animate('scaleX', scaleFactor, { duration: 400, onChange: canvas.renderAll.bind(canvas), easing: fabric.util.ease.easeOutBack });
        loadedObj.animate('scaleY', scaleFactor, { duration: 400, easing: fabric.util.ease.easeOutBack });
    });
}

/* --- 인스타그램 스타일 삭제 (휴지통) --- */
const deleteZone = document.getElementById('delete-zone');

canvas.on('object:moving', (e) => {
    const obj = e.target;
    if (!obj) return;

    deleteZone.classList.add('visible');
    deleteZone.classList.remove('hidden');

    if (obj.top > canvas.height * 0.85) {
        deleteZone.classList.add('delete-active');
        obj.set('opacity', 0.5);
    } else {
        deleteZone.classList.remove('delete-active');
        obj.set('opacity', 1);
    }
});

canvas.on('mouse:up', () => {
    const obj = canvas.getActiveObject();
    deleteZone.classList.remove('visible');
    deleteZone.classList.remove('delete-active');

    if (obj && obj.top > canvas.height * 0.85) {
        canvas.remove(obj);
        canvas.discardActiveObject();
    } else if (obj) {
        obj.set('opacity', 1);
    }
    canvas.renderAll();
});

canvas.on('object:scaling', () => deleteZone.classList.remove('visible'));
canvas.on('object:rotating', (opt) => {
    if (opt.target) {
        // 45도 스냅
        opt.target.angle = Math.round(opt.target.angle / 45) * 45;
        deleteZone.classList.remove('visible');
    }
});

/* --- 서버 전송 --- */
function sendFlower() {
    const username = document.getElementById('username').value;
    const location = document.getElementById('district-select').value;
    const objects = canvas.getObjects();

    if (objects.length === 0) { alert("조각을 하나 이상 배치해주세요!"); return; }

    const flowerData = {
        userName: username,
        location: location,
        shapes: objects.map((obj, index) => ({
            type: obj.get('type') || 'unknown',
            color: obj.get('userColor') || currentSelectedColor,
            x: obj.left, y: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY,
            rotation: obj.angle,
            layerOrder: index,
            componentType: obj.get('componentType') || 'Flower'
        }))
    };

    socket.emit("submit_flower", flowerData);

    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');
}