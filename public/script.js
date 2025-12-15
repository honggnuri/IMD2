// script.js (최종 수정 버전 - 개별 색상 전송 버그 수정)

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

const districtShapes = {
    'eojindong': ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'],
    'dodam': ['F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'],
    'areum': ['F15', 'F16', 'F17', 'F18', 'F19', 'F4'],
    'hamildong': ['F21', 'F22', 'F23', 'F24', 'F25', 'F26', 'F27'],
    'naseongdong': ['F28', 'F15', 'F29', 'F30', 'F31', 'F32', 'F33'],
    'bangok_jiphyeon': ['F34', 'F35', 'F36', 'F37', 'F38', 'F39', 'F40'],
    'jochiwon': ['F6', 'F2', 'F13', 'F12', 'F20', 'F41', 'F32'],
    'jeonui_myeon': ['F32', 'F13', 'F40', 'F11', 'F24', 'F20', 'F12'],
    'yeonseomyeon': ['F8', 'F40', 'F20', 'F15', 'F23', 'F6', 'F17'],
    'bugangmyeon': ['F42', 'F19', 'F31', 'F13', 'F25', 'F18', 'F43'],
    'geumnammyeon': ['F18', 'F23', 'F42', 'F25', 'F29', 'F36', 'F44'],
    'yeongimyeon': ['F2', 'F20', 'F28', 'F27', 'F1', 'F11', 'F45'],
    'janggunmyeon': ['F44', 'F38', 'F3', 'F28', 'F42', 'F18', 'F17'],
    'yeondongmyeon': ['F19', 'F14', 'F24', 'F38', 'F31', 'F37', 'F25'],
    'otherarea': ['F40', 'F28', 'F17', 'F30', 'F19', 'F44', 'F14']
};

/* =========================================
   SVG 텍스트 및 색상 유틸리티
   ========================================= */
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

    // 🌟 [수정 1] 이미 배치된 조각의 색을 바꿀 때, 데이터(userColor)도 함께 업데이트
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        applyColorToSvg(activeObject, color);
        activeObject.set('userColor', color); // 색상 정보 저장
        canvas.renderAll();
    }

    updatePaletteSvgColors(color);
}

function updatePaletteSvgColors(color) {
    document.querySelectorAll('.shape-btn').forEach(btn => {
        const originalSvg = btn.getAttribute('data-original-svg');
        if (originalSvg) {
            const coloredSvg = colorizeSvgText(originalSvg, color);
            btn.innerHTML = coloredSvg;
        }
    });
}

/* =========================================
   조각 타입 결정 유틸리티
   ========================================= */
function assignComponentType(index, totalCount) {
    const splitPoint = (totalCount === 7) ? 4 : 3;
    return (index < splitPoint) ? "Flower" : "Leaf";
}

/* =========================================
   도형 팔레트 생성
   ========================================= */
async function generatePalette(districtCode) {
    const flowerPaletteDiv = document.getElementById('flower-palette-container');
    const leafPaletteDiv = document.getElementById('leaf-palette-container');
    flowerPaletteDiv.innerHTML = '';
    leafPaletteDiv.innerHTML = '';

    const shapeNames = districtShapes[districtCode] || [];

    const svgLoadPromises = shapeNames.map(shapeName =>
        fetch(`assets/${shapeName}.svg`)
            .then(response => response.text())
            .then(svgText => ({ shapeName, svgText }))
            .catch(error => {
                console.error(`Error loading SVG ${shapeName}:`, error);
                return { shapeName, svgText: `<svg width="60" height="60"><text y="30" fill="red">${shapeName} ERR</text></svg>` };
            })
    );

    const loadedSvgs = await Promise.all(svgLoadPromises);
    const totalCount = loadedSvgs.length;

    const components = loadedSvgs.map(({ shapeName, svgText }, index) => ({
        shapeName,
        svgText,
        componentType: assignComponentType(index, totalCount)
    }));

    components.forEach(comp => {
        const btn = createPaletteButton(comp.shapeName, comp.svgText, comp.componentType);
        flowerPaletteDiv.appendChild(btn);
    });

    components.forEach(comp => {
        const btn = createPaletteButton(comp.shapeName, comp.svgText, comp.componentType);
        leafPaletteDiv.appendChild(btn);
    });
}

function createPaletteButton(shapeName, svgText, componentType) {
    const btn = document.createElement('div');
    btn.className = 'shape-btn';

    btn.setAttribute('data-original-svg', svgText);

    const coloredSvg = colorizeSvgText(svgText, currentSelectedColor);
    btn.innerHTML = coloredSvg;

    btn.setAttribute('draggable', true);

    btn.addEventListener('dragstart', (e) => {
        const dataToSend = {
            type: shapeName,
            color: currentSelectedColor,
            componentType: componentType
        };
        e.dataTransfer.setData('shapeData', JSON.stringify(dataToSend));
    });

    btn.onclick = () => {
        addShapeAtPosition({ type: shapeName, color: currentSelectedColor, componentType: componentType }, 250, 250);
    };

    return btn;
}

/* =========================================
   화면 전환 및 초기화
   ========================================= */
function goToFlowerSelection() {
    document.getElementById('leaf-selection-view').classList.add('hidden');
    document.getElementById('flower-selection-view').classList.remove('hidden');
}

function goToLeafSelection() {
    document.getElementById('flower-selection-view').classList.add('hidden');
    document.getElementById('leaf-selection-view').classList.remove('hidden');
}

async function goToStep2() {
    const username = document.getElementById('username').value.trim();
    const districtSelect = document.getElementById('district-select');
    const selectedDistrict = districtSelect.value;

    if (!username) { alert("이름을 입력해주세요!"); return; }
    if (!selectedDistrict) { alert("동네를 선택해주세요!"); return; }

    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');

    resizeCanvas();
    canvas.requestRenderAll();

    initColorPalette();
    await generatePalette(selectedDistrict);
    goToFlowerSelection();
}

function resizeCanvas() {
    const wrapper = document.querySelector('.canvas-wrapper');
    const wrapperWidth = wrapper.getBoundingClientRect().width;
    const newSize = wrapperWidth;

    canvas.setWidth(newSize);
    canvas.setHeight(newSize);
    wrapper.style.height = `${newSize}px`;
    canvas.renderAll();
}

window.addEventListener('resize', resizeCanvas);
document.addEventListener('DOMContentLoaded', resizeCanvas);

/* =========================================
   드래그 핸들러 및 45도 스냅
   ========================================= */
const canvasContainer = document.querySelector('.canvas-wrapper');
canvasContainer.addEventListener('dragover', function (e) { e.preventDefault(); canvasContainer.classList.add('drag-over'); });
canvasContainer.addEventListener('dragleave', function (e) { canvasContainer.classList.remove('drag-over'); });
canvasContainer.addEventListener('drop', function (e) {
    e.preventDefault();
    canvasContainer.classList.remove('drag-over');
    const jsonStr = e.dataTransfer.getData('shapeData');
    if (!jsonStr) return;
    const shapeData = JSON.parse(jsonStr);
    const rect = canvas.getElement().getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addShapeAtPosition(shapeData, x, y);
});

canvas.on('object:rotating', function (options) {
    const target = options.target;
    if (target) {
        let angle = target.angle;
        const snapAngle = 45;
        const snappedAngle = Math.round(angle / snapAngle) * snapAngle;
        target.set('angle', snappedAngle);
    }
});

/* =========================================
   SVG 로드 및 캔버스 추가
   ========================================= */
function addShapeAtPosition(data, x, y) {
    const svgPath = `assets/${data.type}.svg`;

    fabric.loadSVGFromURL(svgPath, (objects, options) => {
        const loadedObj = fabric.util.groupSVGElements(objects, options);

        applyColorToSvg(loadedObj, data.color);

        loadedObj.set({
            left: x, top: y, originX: 'center', originY: 'center', angle: 0, opacity: 0.9,
            hasControls: true, hasBorders: true,
            lockScalingX: true, lockScalingY: true, lockRotation: false, lockUniScaling: true,
            perPixelTargetFind: true
        });

        loadedObj.set('componentType', data.componentType);
        loadedObj.set('type', data.type);

        // 🌟 [수정 2] 조각 생성 시, 해당 조각의 색상을 프로퍼티로 저장
        loadedObj.set('userColor', data.color);

        canvas.add(loadedObj);
        canvas.bringToFront(loadedObj);

        loadedObj.set({ scaleX: 0, scaleY: 0 });
        loadedObj.animate('scaleX', 0.5, { duration: 300, onChange: canvas.renderAll.bind(canvas), easing: fabric.util.ease.easeOutBack });
        loadedObj.animate('scaleY', 0.5, { duration: 300, easing: fabric.util.ease.easeOutBack });
    });
}

canvas.on('mouse:down', function (options) {
    if (options.target) {
        canvas.bringToFront(options.target);
    }
});

/* =========================================
   서버로 꽃 데이터 전송 (버그 수정됨)
   ========================================= */
function sendFlower() {
    const username = document.getElementById('username').value;
    const location = document.getElementById('district-select').value;
    const objects = canvas.getObjects();

    if (objects.length === 0) { alert("조각을 드래그해서 꽃을 만들어주세요!"); return; }

    const flowerData = {
        userName: username,
        location: location,
        shapes: objects.map((obj, index) => ({
            type: obj.get('type') || 'unknown',

            // 🌟 [수정 3] 마지막 선택 색상(currentSelectedColor)이 아니라
            // 각 조각이 기억하고 있는 색상(userColor)을 보냄
            color: obj.get('userColor') || currentSelectedColor,

            x: obj.left, y: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            rotation: obj.angle,
            layerOrder: index,
            componentType: obj.get('componentType') || 'Unknown'
        }))
    };

    socket.emit("submit_flower", flowerData);

    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');

}

/* =========================================
   [디버깅용] 랜덤 꽃 자동 생성 버튼 & 로직
   ========================================= */
function createDebugButton() {
    // 중복 생성 방지
    if (document.getElementById('debug-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'debug-btn';
    btn.innerText = "🎲 자동 완성 (Full)";
    btn.style.position = "fixed";
    btn.style.bottom = "20px";
    btn.style.right = "20px";
    btn.style.zIndex = "9999";
    btn.style.padding = "15px 20px";
    btn.style.fontSize = "16px";
    btn.style.fontWeight = "bold";
    btn.style.backgroundColor = "#20bf6b"; // 초록색으로 변경
    btn.style.color = "white";
    btn.style.border = "none";
    btn.style.borderRadius = "30px";
    btn.style.boxShadow = "0 4px 6px rgba(0,0,0,0.2)";
    btn.style.cursor = "pointer";

    btn.onclick = generateRandomFlowerFull; 
    document.body.appendChild(btn);
}

// 2. [핵심] Step 1부터 Step 2 꽃 생성까지 한방에 처리
async function generateRandomFlowerFull() {
    
    // --- [단계 1] Step 1 화면이라면 이름/동네 자동 선택 ---
    const step1 = document.getElementById('step-1');
    if (!step1.classList.contains('hidden')) {
        console.log("🛠️ Step 1 자동 패스 중...");

        // 1. 이름 랜덤 입력
        const randomNames = ["철수", "영희", "User", "Tester", "Bot"];
        const randomNum = Math.floor(Math.random() * 1000);
        const randName = randomNames[Math.floor(Math.random() * randomNames.length)] + "_" + randomNum;
        document.getElementById('username').value = randName;

        // 2. 동네 랜덤 선택
        const districtSelect = document.getElementById('district-select');
        const keys = Object.keys(districtShapes);
        // 'otherarea' 같은 게 나올 수 있으니 랜덤 픽
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        districtSelect.value = randomKey;

        // 3. 다음 단계로 이동 (goToStep2는 async 함수이므로 await)
        await goToStep2(); 
    }

    // --- [단계 2] 캔버스 초기화 및 랜덤 꽃 그리기 ---
    canvas.clear();
    canvas.backgroundColor = '#ffffff';

    const districtSelect = document.getElementById('district-select');
    const district = districtSelect.value;
    const availableShapes = districtShapes[district];

    if (!availableShapes || availableShapes.length === 0) {
        console.error("도형 데이터가 없습니다.");
        return;
    }

    // 조각 개수 랜덤 (5~8개)
    const numShapes = Math.floor(Math.random() * 4) + 5; 
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < numShapes; i++) {
        // 랜덤 모양
        const shapeIndex = Math.floor(Math.random() * availableShapes.length);
        const shapeName = availableShapes[shapeIndex];
        
        // 랜덤 색상
        const randomColor = colorList[Math.floor(Math.random() * colorList.length)];

        // 타입 결정
        const totalCount = availableShapes.length;
        const compType = assignComponentType(shapeIndex, totalCount);

        // 위치 랜덤 (중심에서 -60 ~ +60 픽셀)
        const offsetX = (Math.random() - 0.5) * 120; 
        const offsetY = (Math.random() - 0.5) * 120;

        // 각도 랜덤 (45도 단위)
        const randomAngle = Math.floor(Math.random() * 8) * 45;
        
        // 데이터 구성
        const data = {
            type: shapeName,
            color: randomColor,
            componentType: compType
        };

        // 조각 추가 실행
        addShapeAtPosition_Random(data, centerX + offsetX, centerY + offsetY, randomAngle);
    }
    
    console.log(`🌸 [${district}] 자동 꽃 생성 완료!`);
}

// 3. 랜덤 배치를 위한 헬퍼 함수 (회전값 적용)
function addShapeAtPosition_Random(data, x, y, angle) {
    const svgPath = `assets/${data.type}.svg`; 
    
    fabric.loadSVGFromURL(svgPath, (objects, options) => {
        const loadedObj = fabric.util.groupSVGElements(objects, options);

        applyColorToSvg(loadedObj, data.color);

        loadedObj.set({
            left: x, top: y, 
            originX: 'center', originY: 'center', 
            angle: angle, 
            opacity: 0.9,
            hasControls: true, hasBorders: true,
            lockScalingX: true, lockScalingY: true, 
            lockRotation: false, lockUniScaling: true,
            perPixelTargetFind: true
        });

        loadedObj.set('componentType', data.componentType); 
        loadedObj.set('type', data.type); 
        loadedObj.set('userColor', data.color); 

        canvas.add(loadedObj);
        
        // 뿅 하고 나타나는 효과
        loadedObj.set({ scaleX: 0, scaleY: 0 });
        loadedObj.animate('scaleX', 0.5, { duration: 300, onChange: canvas.renderAll.bind(canvas), easing: fabric.util.ease.easeOutBack });
        loadedObj.animate('scaleY', 0.5, { duration: 300, easing: fabric.util.ease.easeOutBack });
    });
}

// 페이지 로드 시 버튼 생성
createDebugButton();