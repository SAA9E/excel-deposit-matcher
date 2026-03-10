async function processFiles() {
    const bankFile = document.getElementById('bankFile').files[0];
    const attendanceFile = document.getElementById('attendanceFile').files[0];

    if (!bankFile || !attendanceFile) {
        alert("두 파일 모두 업로드해주세요!");
        return;
    }

    const readExcel = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // 행 데이터를 배열 형태로 가져와서 실제 헤더 위치를 찾음
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                resolve(rows);
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const bankRows = await readExcel(bankFile);
    const attendanceRows = await readExcel(attendanceFile);

    // --- 1. 입출금내역 데이터 가공 ---
    // '거래기록사항' 또는 '내용'이 포함된 행을 헤더로 인식
    const bankHeaderIdx = bankRows.findIndex(row => row.includes('거래기록사항') || row.includes('기재내용'));
    const bankData = bankRows.slice(bankHeaderIdx + 1);
    const bankHeader = bankRows[bankHeaderIdx];
    
    const nameColIdx = bankHeader.indexOf('거래기록사항'); // 이름이 들어있는 열
    const bankNames = bankData
        .map(row => String(row[nameColIdx] || '').trim())
        .filter(name => name !== '' && name !== 'undefined');

    const bankCountMap = {};
    bankNames.forEach(name => {
        bankCountMap[name] = (bankCountMap[name] || 0) + 1;
    });

    const uniqueBankUsers = Object.keys(bankCountMap);
    const duplicates = Object.entries(bankCountMap).filter(([_, count]) => count > 1);

    // --- 2. 출석부 데이터 가공 ---
    const attHeaderIdx = attendanceRows.findIndex(row => row.includes('이름'));
    const attData = attendanceRows.slice(attHeaderIdx + 1);
    const attHeader = attendanceRows[attHeaderIdx];
    const attNameColIdx = attHeader.indexOf('이름');
    
    const attendanceNames = attData
        .map(row => String(row[attNameColIdx] || '').trim())
        .filter(name => name !== '' && name !== 'undefined');
    const uniqueAttendanceUsers = [...new Set(attendanceNames)];

    // --- 3. 매칭 로직 (규칙은 추후 수정 가능) ---
    // 현재는 입출금의 '거래기록사항'에 출석부의 '이름'이 포함되어 있는지 확인
    const matched = [];
    const failed = [];

    uniqueBankUsers.forEach(bankEntry => {
        // 출석부 명단 중 하나라도 포함되어 있는지 체크
        const isFound = uniqueAttendanceUsers.some(attName => bankEntry.includes(attName));
        if (isFound) {
            matched.push(bankEntry);
        } else {
            failed.push(bankEntry);
        }
    });

    // --- 결과 출력 ---
    let resultHTML = `<div class="res-section"><strong>1. 입출금내역의 명단은 ${uniqueBankUsers.length}명입니다.</strong><br>`;
    if (duplicates.length > 0) {
        duplicates.forEach(([name, count]) => {
            resultHTML += `<span style="color: #e67e22;">  • ${name}님이 ${count}번 입금했습니다.</span><br>`;
        });
    }
    resultHTML += `</div><br>`;

    resultHTML += `<div class="res-section"><strong>2. 출석부의 명단은 ${uniqueAttendanceUsers.length}명입니다.</strong></div><br>`;

    resultHTML += `<div class="res-section"><strong>3. 일치하는 내역은 ${uniqueBankUsers.length}건 중 ${matched.length}명이고, <span style="color:red;">매치 실패한 내역은 ${failed.length}건</span>입니다.</strong></div>`;

    document.getElementById('result').innerHTML = resultHTML;
}
