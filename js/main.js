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

    // --- 1. 입출금내역 분석 ---
    const bankHeaderIdx = bankRows.findIndex(row => row.includes('거래기록사항'));
    const bankHeader = bankRows[bankHeaderIdx];
    const bankNameColIdx = bankHeader.indexOf('거래기록사항');
    
    const bankEntries = bankRows.slice(bankHeaderIdx + 1)
        .map(row => String(row[bankNameColIdx] || '').trim())
        .filter(n => n && n !== 'undefined');

    const bankCountMap = {};
    bankEntries.forEach(name => { bankCountMap[name] = (bankCountMap[name] || 0) + 1; });
    const uniqueBankUsers = Object.keys(bankCountMap);

    // --- 2. 출석부 분석 ---
    const attHeaderIdx = attendanceRows.findIndex(row => row.includes('이름'));
    const attHeader = attendanceRows[attHeaderIdx];
    const attNameColIdx = attHeader.indexOf('이름');
    
    const attendanceEntries = attendanceRows.slice(attHeaderIdx + 1)
        .map(row => String(row[attNameColIdx] || '').trim())
        .filter(n => n && n !== 'undefined');
    const uniqueAttendanceUsers = [...new Set(attendanceEntries)];

    // --- 3. 매칭 로직 (양방향 대조) ---
    
    // [A] 입출금 명단 기준: 출석부에 있는가?
    const matchedBankUsers = [];
    const unidentifiedDeposits = []; // 입금은 했으나 출석부엔 없는 사람

    uniqueBankUsers.forEach(bankName => {
        const isMatch = uniqueAttendanceUsers.some(attName => bankName.includes(attName));
        if (isMatch) matchedBankUsers.push(bankName);
        else unidentifiedDeposits.push(bankName);
    });

    // [B] 출석부 명단 기준: 입출금 내역에 있는가?
    const unpaidStudents = []; // 신청은 했으나 입금 내역이 없는 사람

    uniqueAttendanceUsers.forEach(attName => {
        const isPaid = uniqueBankUsers.some(bankName => bankName.includes(attName));
        if (!isPaid) unpaidStudents.push(attName);
    });

    // --- 결과 출력 ---
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';

    let html = `<h3>✅ 대조 리포트 결과</h3>`;
    
    // 1. 입출금내역 리포트
    html += `<div style="margin-bottom:15px;">
                <strong>1. 입출금내역의 명단은 ${uniqueBankUsers.length}명입니다.</strong><br>`;
    const duplicates = Object.entries(bankCountMap).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
        duplicates.forEach(([name, count]) => {
            html += `<span style="color:blue; font-size:0.9em; margin-left:10px;">• ${name}님이 ${count}번 입금했습니다.</span><br>`;
        });
    }
    html += `</div>`;

    // 2. 출석부 리포트
    html += `<div style="margin-bottom:15px;">
                <strong>2. 출석부의 명단은 ${uniqueAttendanceUsers.length}명입니다.</strong>
             </div>`;

    // 3. 매칭 요약
    html += `<div style="border-top:1px solid #ddd; padding-top:15px;">
                <strong>3. 매칭 요약:</strong><br>
                - 일치하는 내역: ${uniqueBankUsers.length}건 중 <strong>${matchedBankUsers.length}명</strong> 일치<br>
                - 매치 실패(입금만 확인됨): <span style="color:red;">${unidentifiedDeposits.length}건</span><br>
                - 미입금(출석부엔 있으나 입금 안됨): <span style="color:red;">${unpaidStudents.length}명</span>
             </div>`;

    // 4. 상세 내역 (실패 케이스 상세)
    if (unidentifiedDeposits.length > 0 || unpaidStudents.length > 0) {
        html += `<div style="margin-top:20px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div style="background:#fff5f5; padding:10px; border:1px solid #feb2b2; border-radius:5px;">
                        <strong style="color:#c53030;">❌ 미신청 입금자</strong><br>
                        <small>(입금기록O, 출석부X)</small><hr>
                        ${unidentifiedDeposits.join('<br>') || '없음'}
                    </div>
                    <div style="background:#fffaf0; padding:10px; border:1px solid #fbd38d; border-radius:5px;">
                        <strong style="color:#9c4221;">⚠️ 미입금 신청자</strong><br>
                        <small>(출석부O, 입금기록X)</small><hr>
                        ${unpaidStudents.join('<br>') || '없음'}
                    </div>
                 </div>`;
    }

    resultDiv.innerHTML = html;
}
