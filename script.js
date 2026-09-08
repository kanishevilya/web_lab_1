const yButtons = document.querySelectorAll('.y-btn');
const yInput = document.getElementById('y-input');
const xInput = document.getElementById('x-input');
const rInput = document.getElementById('r-input');
const form = document.getElementById('point-form');

const tableBody = document.querySelector('#results-table tbody');

const canvas = document.getElementById('graph');
const context = canvas.getContext('2d');

let results = JSON.parse(localStorage.getItem('lab_results')) || [];

const scale = 35;
const axis_range = 6;

const center_x = canvas.width / 2;
const center_y = canvas.height / 2;

function init() {
    setupYButtons();
    loadTable();

    drawScene(null);

    form.addEventListener('submit', handleFormSubmit);
}

function setupYButtons() {
    yButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            yButtons.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            yInput.value = this.value;
            clearYError();
        })
    })
}

function addTableRow(res) {
    const dateObj = new Date(res.time);
    const timeStr = new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(dateObj);
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${res.x}</td>
        <td>${res.y}</td>
        <td>${res.r}</td>
        <td style="color: ${res.hit ? 'green' : 'red'}">${res.hit ? 'Попадание' : 'Промах'}</td>
        <td>${timeStr}</td>
    `;
    tableBody.prepend(row);
}

function loadTable() {
    tableBody.innerHTML = '';
    results.forEach(res => addTableRow(res));
}

function validateValue(strVal, min, max) {
    let str = strVal.replace(',', '.').trim();
    if (str === '') {
        return { valid: false, error: 'Поле не может быть пустым' };
    }

    const regex = /^-?\d+(\.\d+)?$/;
    if (!regex.test(str)) {
        return { valid: false, error: 'Введите корректное число' };
    }

    let isNegative = str.startsWith('-');
    let absoluteStr = isNegative ? str.substring(1) : str;
    let parts = absoluteStr.split('.');
    let intPart = parseInt(parts[0], 10);
    let decPart = parts[1] || '';
    decPart = decPart.replace(/0+$/, '');

    let sign = (intPart === 0 && decPart === '') ? 1 : (isNegative ? -1 : 1);
    if (sign === 1) {
        if (intPart > max || (intPart === max && decPart.length > 0)) {
            return { valid: false, error: `Значение должно быть не больше ${max}` };
        }
        if (intPart < min) {
            return { valid: false, error: `Значение должно быть не меньше ${min}` };
        }
    } else {
        if (-intPart < min || (-intPart === min && decPart.length > 0)) {
            return { valid: false, error: `Значение должно быть не меньше ${min}` };
        }
        if (-intPart > max) {
            return { valid: false, error: `Значение должно быть не больше ${max}` };
        }
    }
    return { valid: true, value: str};
}

function toScaledBigInt(strX, strY, strR) {
    const getDecLen = (s) => s.includes('.') ? s.split('.')[1].length : 0;

    const maxDec = Math.max(getDecLen(strX), getDecLen(strY), getDecLen(strR));

    const scale = (str) => {
        let [intP, decP = ''] = str.replace('-', '').split('.');
        decP = decP.padEnd(maxDec, '0');
        let sign = str.startsWith('-') ? -1n : 1n;
        return BigInt(intP + decP) * sign;
    };

    return [scale(strX), scale(strY), scale(strR)];
}

function checkHit(strX, strY, strR) {
    const [x, y, r] = toScaledBigInt(strX.toString(), strY.toString(), strR.toString());

    if (x <= 0n && x >= -r && y >= 0n && y*2n <= r) {
        return true;
    }
    if (x >= 0n && y >= 0n && 2n*y <= r - x) {
        return true;
    }    
    if (x <= 0n && y <= 0n && 4n*(x * x + y * y) <= r * r) {
        return true;
    }

    return false;
}

function handleFormSubmit(event) {
    event.preventDefault();
    clearAllErrors();
    let hasError = false;

    const xValidation = validateValue(xInput.value, -5, 5);
    if (!xValidation.valid) {
        showError(xInput, "x-error", xValidation.error);
        hasError = true;
    }

    if (!yInput.value) {
        showError(null, "y-error", "Выберите координату Y");
        hasError = true;
    }

    const rValidation = validateValue(rInput.value, 2, 5);
    if (!rValidation.valid) {
        showError(rInput, "r-error", rValidation.error);
        hasError = true;
    }

    if (hasError) { return; }

    const x = xValidation.value;
    const r = rValidation.value;
    const y = parseFloat(yInput.value);

    const isHit = checkHit(x, y, r);

    const now = new Date();

    const result = {
        x: x,
        y: y,
        r: r,
        hit: isHit,
        time: now.toISOString()
    };

    results.push(result);
    localStorage.setItem('lab_results', JSON.stringify(results));
    addTableRow(result);

    drawScene(r, x, y, isHit);
}

function showError(inputElement, errorId, message) {
    const errorDiv = document.getElementById(errorId);
    errorDiv.textContent = message;
    if (inputElement) {
        inputElement.classList.add('invalid');
    } else if (errorId === 'y-error') {
        yButtons.forEach(b => b.classList.add('invalid-group'));
    }
}

function clearError(inputElement, errorId) {
    const errorDiv = document.getElementById(errorId);
    errorDiv.textContent = '';
    if (inputElement) {
        inputElement.classList.remove('invalid');
    }
}

function clearYError() {
    clearError(null, 'y-error');
    yButtons.forEach(b => b.classList.remove('invalid-group'));
}
function clearAllErrors() {
    clearError(xInput, 'x-error');
    clearError(rInput, 'r-error');
    clearYError();
}

function drawScene(r, x = null, y = null, hit = null) {
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);

    const renderRadius = r !== null ? r : 5;
    drawShapes(renderRadius);
    drawCoords(r);

    if (r !== null && x !== null && y !== null && hit !== null) {
        drawPoint(x, y, hit);
    }
}

function drawPoint(x, y, isHit) {
    const px = center_x + x * scale;
    const py = center_y - y * scale;

    context.beginPath();
    context.arc(px, py, 4, 0, Math.PI * 2);
    context.fillStyle = isHit ? '#47da8c' : '#da2020';
    context.fill();
    context.strokeStyle = '#000000';
    context.stroke();
}

function drawCoords(r) {
    context.strokeStyle = '#000';
    context.lineWidth = 1;
    context.fillStyle = '#000';
    context.font = '12px Arial';

    context.beginPath();
    context.moveTo(0, center_y);
    context.lineTo(canvas.width, center_y);
    context.moveTo(center_x, 0);
    context.lineTo(center_x, canvas.height);

    context.moveTo(canvas.width - 10, center_y - 4); //стрелочки
    context.lineTo(canvas.width, center_y);
    context.lineTo(canvas.width - 10, center_y + 4);
    context.moveTo(center_x - 4, 10);
    context.lineTo(center_x, 0);
    context.lineTo(center_x + 4, 10);
    context.stroke();

    for (let i = -axis_range; i <= axis_range; i += 0.5) {
        if (i === 0) { continue; }
        let px = center_x + i * scale;
        let py = center_y - i * scale;

        context.beginPath();
        if (i % 1 === 0) {
            context.moveTo(px, center_y - 6);
            context.lineTo(px, center_y + 6);
            context.moveTo(center_x - 6, py);
            context.lineTo(center_x + 6, py);
        } else {
            context.moveTo(px, center_y - 3);
            context.lineTo(px, center_y + 3);
            context.moveTo(center_x - 3, py);
            context.lineTo(center_x + 3, py);
        }
        context.stroke();

        let labelX = "";
        let labelY = "";
        if (r === null) {
            switch (i) {
                case 5: labelX = "R"; labelY = "R"; break;
                case 2.5: labelX = "R/2"; labelY = "R/2"; break;
                case -2.5: labelX = "-R/2"; labelY = "-R/2"; break;
                case -5: labelX = "-R"; labelY = "-R"; break;
            }
        } else if(i%1 === 0) {
            labelX = i;
            labelY = i;
        }

        if (labelX) {
            context.fillText(labelX, px - 5, center_y + 18);
        }
        if (labelY) {
            context.fillText(labelY, center_x + 8, py + 4);
        }
    }
}

function drawShapes(r) {
    context.fillStyle = '#8ebff1';

    context.fillRect(center_x - r * scale, center_y - (r / 2) * scale, r * scale, (r / 2) * scale);

    context.beginPath();
    context.moveTo(center_x, center_y);
    context.lineTo(center_x + r * scale, center_y);
    context.lineTo(center_x, center_y - (r / 2) * scale);


    context.moveTo(center_x, center_y);
    context.arc(center_x, center_y, (r / 2) * scale, Math.PI, Math.PI / 2, true);
    context.fill();
}

init();