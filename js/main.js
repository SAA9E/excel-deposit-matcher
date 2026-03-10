async function processFiles() {
    const bankFile = document.getElementById('bankFile').files[0];
    const attendanceFile = document.getElementById('attendanceFile').files[0];

    if (!bankFile || !attendanceFile) {
        alert("두 파일을 모두 업로드해주세요!");
        return;
    }

    const readExcel = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                resolve(rows);
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const bankRows = await readExcel(bankFile);
    const attendanceRows = await readExcel(attendanceFile);

    // 1. 입출금내역 분석 (은행 파일 - '거래기록사항' 열 기준)
    const bankHeaderIdx = bankRows.findIndex(row => row.includes('거래기록사항'));
    const bankHeader = bankRows[bankHeaderIdx];
    const bankNameColIdx = bankHeader.indexOf('거래기록사항');
    
    const bankEntries = bankRows.slice(bankHeaderIdx + 1)
        .map(row => String(row[bankNameColIdx] || '').trim())
        .filter(n => n && n !== 'undefined');

    const bankCountMap = {};
    bankEntries.forEach(name => { bankCountMap[name] = (bankCountMap[name] || 0) + 1; });
    const uniqueBankUsers = Object.keys(bankCountMap);
    const duplicates = Object.entries(bankCountMap).filter(([_, count]) => count > 1);

    // 2. 출석부 분석 (출석부 파일 - '이름' 열 기준)
    const attHeaderIdx = attendanceRows.findIndex(row => row.includes('이름'));
    const attHeader = attendanceRows[attHeaderIdx];
    const attNameColIdx = attHeader.indexOf('이름');
    
    const attendanceEntries = attendanceRows.slice(attHeaderIdx + 1)
        .map(row => String(row[attNameColIdx] || '').trim())
        .filter(n => n && n !== 'undefined');
    const uniqueAttendanceUsers = [...new Set(attendanceEntries)];

    // 3. 매칭
    const matched = [];
    const failed = [];

    uniqueBankUsers.forEach(bankName => {
        const isMatch = uniqueAttendanceUsers.some(attName => bankName.includes(attName));
        if (isMatch) matched.push(bankName);
        else failed.push(bankName);
    });

    // 결과 출력
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';

    let html = `<h3>✅ 대조 리포트</h3>`;
    
    // 1번 출력
    html += `<p><strong>1. 입출금내역의 명단은 ${uniqueBankUsers.length}명입니다.</strong><br>`;
    if (duplicates.length > 0) {
        duplicates.forEach(([name, count]) => {
            html += `<span class="duplicate-info">• ${name}님이 ${count}번 입금했습니다.</span><br>`;
        });
    }
    html += `</p>`;

    // 2번 출력
    html += `<p><strong>2. 출석부의 명단은 ${uniqueAttendanceUsers.length}명입니다.</strong></p>`;

    // 3번 출력
    html += `<p><strong>3. 일치하는 내역은 ${uniqueBankUsers.length}건 중 ${matched.length}명이고, 매치 실패한 내역은 <span style="color:red;">${failed.length}건</span>입니다.</strong></p>`;

    if (failed.length > 0) {
        html += `<div style="background:#fef2f2; padding:10px; border-radius:5px; border:1px solid #fee2e2;">
                    <strong>❌ 매치 실패(확인 필요):</strong> ${failed.join(', ')}
                 </div>`;
    }

    resultDiv.innerHTML = html;
}
