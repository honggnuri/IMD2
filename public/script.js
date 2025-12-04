
const socket = io("http://54.252.151.147:3000");
const canvas = new fabric.Canvas('c');
canvas.backgroundColor = '#ffffff';
canvas.selection = false;

// 사용할 색상 목록 (파스텔 톤 위주)
const colorList = [
    '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', // 파스텔
    '#FF6B6B', '#4DABF7', '#FFD43B', '#69DB7C', '#FCC2D7' // 진한 색
];

// 현재 선택된 색상 (기본값: 첫 번째 색)
let currentSelectedColor = colorList[0];

// 동네별 도형 데이터 (이제 여기서 color는 제거하고, 모양 정보만 씁니다)
const districtShapes = {
    'areum': [
        { type: 'circle', cssShape: '50%' },
        { type: 'circle', cssShape: '50%' },
        { type: 'ellipse', cssShape: '50% / 30%' }
    ],
    'dodam': [
        { type: 'triangle', cssShape: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
        { type: 'triangle', cssShape: 'polygon(50% 0%, 0% 100%, 100% 100%)' },
        { type: 'rect', cssShape: '0%' }
    ],
    'boram': [
        { type: 'rect', cssShape: '0%' },
        { type: 'rect', cssShape: '0%' },
        { type: 'rect', cssShape: '0%' }
    ]
};

/* =========================================
   2. 색상 팔레트 생성 함수 (새로 추가됨)
   ========================================= */
function initColorPalette() {
    const colorContainer = document.getElementById('color-palette');
    colorContainer.innerHTML = '';

    colorList.forEach((color, index) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = color;

        // 첫 번째 색상은 기본 선택 상태로
        if (index === 0) btn.classList.add('active');

        btn.onclick = () => selectColor(btn, color);
        colorContainer.appendChild(btn);
    });
}

// 색상을 클릭했을 때 실행되는 함수
function selectColor(btnElement, color) {
    // 1. 변수 업데이트
    currentSelectedColor = color;

    // 2. 버튼 활성화 표시 (테두리 등)
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');

    // 3. [중요] 도형 팔레트의 모든 버튼 색을 이 색으로 변경
    document.querySelectorAll('.shape-btn').forEach(shapeBtn => {
        shapeBtn.style.backgroundColor = color;
    });

    // 4. [기능 추가] 캔버스에 이미 선택된 도형이 있다면 색 바꾸기
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
        activeObject.set('fill', color);
        canvas.renderAll();
    }
}


/* =========================================
   3. 도형 팔레트 생성 (업데이트됨)
   ========================================= */

function generatePalette(districtCode) {
    const paletteDiv = document.getElementById('shape-palette');
    const shapes = districtShapes[districtCode];

    paletteDiv.innerHTML = '';

    shapes.forEach((shapeData) => {
        const btn = document.createElement('div');
        btn.className = 'shape-btn';

        // 초기 색상은 현재 선택된 색상으로 설정
        btn.style.backgroundColor = currentSelectedColor;

        // 모양 CSS 적용
        if (shapeData.cssShape.startsWith('polygon')) {
            btn.style.clipPath = shapeData.cssShape;
        } else {
            btn.style.borderRadius = shapeData.cssShape;
        }

        btn.setAttribute('draggable', true);

        // [중요] 드래그 시작 시점의 '현재 색상'을 데이터에 담아 보냄
        btn.addEventListener('dragstart', (e) => {
            const dataToSend = {
                type: shapeData.type,
                color: currentSelectedColor // ★ 여기서 현재 색을 넣습니다!
            };
            e.dataTransfer.setData('shapeData', JSON.stringify(dataToSend));
        });

        // 클릭해서 추가하는 경우를 위해 (모바일 등)
        btn.onclick = () => {
            // 클릭 시점의 색상 사용
            addShapeAtPosition({ ...shapeData, color: currentSelectedColor }, 250, 250);
        };

        paletteDiv.appendChild(btn);
    });
}


/* =========================================
   4. 화면 전환 함수 (초기화 로직 추가)
   ========================================= */

function goToStep2() {
    const username = document.getElementById('username').value.trim();
    const districtSelect = document.getElementById('district-select');
    const selectedDistrict = districtSelect.value;

    if (!username) { alert("이름을 입력해주세요!"); return; }
    if (!selectedDistrict) { alert("동네를 선택해주세요!"); return; }

    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    canvas.requestRenderAll();

    // 색상 팔레트 만들기
    initColorPalette();
    // 도형 팔레트 만들기
    generatePalette(selectedDistrict);
}

// ... (이하 드래그 앤 드롭 로직, addShapeAtPosition, sendFlower 등은 기존과 동일) ...

/* =========================================
   (기존 코드 유지 부분 - 복붙 편의를 위해 핵심만 다시 적어둠)
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

function addShapeAtPosition(data, x, y) {
    let shape;
    const commonProps = {
        left: x, top: y, fill: data.color, // 데이터의 색상 사용
        originX: 'center', originY: 'center', angle: 0, opacity: 0.9,
        hasControls: false, hasBorders: false, lockRotation: true, lockScalingX: true, lockScalingY: true, perPixelTargetFind: true
    };
    if (data.type === 'circle') shape = new fabric.Circle({ ...commonProps, radius: 45 });
    else if (data.type === 'rect') shape = new fabric.Rect({ ...commonProps, width: 90, height: 90 });
    else if (data.type === 'triangle') shape = new fabric.Triangle({ ...commonProps, width: 90, height: 90 });
    else if (data.type === 'ellipse') shape = new fabric.Ellipse({ ...commonProps, rx: 60, ry: 35 });

    canvas.add(shape);
    canvas.bringToFront(shape);

    // 등장 애니메이션
    shape.set({ scaleX: 0, scaleY: 0 });
    shape.animate('scaleX', 1, { duration: 300, onChange: canvas.renderAll.bind(canvas), easing: fabric.util.ease.easeOutBack });
    shape.animate('scaleY', 1, { duration: 300, easing: fabric.util.ease.easeOutBack });
}

// 클릭 시 도형 선택 및 색상 변경 가능하게 이벤트 연결
canvas.on('mouse:down', function (options) {
    if (options.target) {
        canvas.bringToFront(options.target);
        // 만약 사용자가 현재 선택해둔 색상이 있다면, 클릭한 도형 색도 바꿀지?
        // (UX상 헷갈릴 수 있으니, 여기서는 '색상 버튼을 눌렀을 때만' 바꾸도록 처리했습니다. 
        //  위쪽 selectColor 함수 참조)
    }
});

function sendFlower() {
    // 기존과 동일
    const username = document.getElementById('username').value;
    const location = document.getElementById('district-select').value;
    const objects = canvas.getObjects();
    if (objects.length === 0) { alert("도형을 드래그해서 꽃을 만들어주세요!"); return; }
    const flowerData = {
        userName: username, location: location,
        shapes: objects.map((obj, index) => ({
            type: obj.type, color: obj.fill, x: obj.left, y: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY, rotation: obj.angle, layerOrder: index
        }))
    };
    socket.emit("submit_flower", flowerData);
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.remove('hidden');
}