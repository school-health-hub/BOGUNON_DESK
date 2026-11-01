import {it,expect} from 'vitest';
import {analyzeCsv,csvRows,decodeCsv,CSV_LIMITS,parseMappedRows,headerOptions} from '../main/purchase-csv';
const bytes=(s:string)=>Buffer.from(s);
it('matches Rust titled-table/amount-only-footer/repeated-header/total fixtures and item serialization',()=>{
 const result=analyzeCsv(bytes('합성 견적서\r\n품명,규격,수량,단가,금액\r\n합성 품목,20L,2,"1,500",3001\r\n품명,규격,수량,단가,금액\r\n합계,,,,3001\r\n,,,,3001\r\n'), 'synthetic.csv');
 expect(result).toEqual({items:[{id:'purchase-0-0',selected:true,name:'합성 품목',specification:'20L',quantity:2,unitPrice:1500,importedAmount:3001,vendor:'',note:'',budgetItem:'',sourceName:'synthetic.csv',issues:['amountMismatch'],amountMismatchReviewed:false}],sources:[{sourceName:'synthetic.csv',status:'success',rowCount:1,message:null}],candidates:[]});
 const emptyNumeric=analyzeCsv(bytes('품명,수량,단가\n합성,,\n'), 'synthetic.csv').items[0];
 // Rust importer leaves absent numeric fields null without pre-emptive issues; original UI readiness stays unchanged.
 expect(emptyNumeric).toMatchObject({quantity:null,unitPrice:null,issues:[]});
});
it('handles BOM, CRLF, escaped quotes, embedded newlines and variable-width rows',()=>{
 expect(csvRows(decodeCsv(bytes('\ufeff품명,수량,단가\r\n"합성 ""품목""\n두 줄",2,10\r\n')))).toEqual([['품명','수량','단가'],['합성 "품목"\n두 줄','2','10']]);
 expect(csvRows('a,b\n1\n2,3,4\n')).toEqual([['a','b'],['1'],['2','3','4']]);
});
it('decodes EUC-KR/CP949 Korean text without replacement',()=>{
 const encoded=Buffer.from('c7b0b8ed2cbcf6b7ae2cb4dcb0a10ac7d5bcba2c322c3130300a','hex');
 expect(analyzeCsv(encoded,'synthetic.csv').items[0]).toMatchObject({name:'합성',quantity:2,unitPrice:100});
});
it('offers Rust-compatible generic header ranking and manual mapping',()=>{
 const result=analyzeCsv(bytes('설명\n대상,개입,예상값\n합성,2,100\n'),'synthetic.csv'),candidate=result.candidates[0];
 expect(result.sources[0]).toMatchObject({status:'needsMapping',candidateId:candidate.id});expect(candidate.sheetName).toBe('CSV');
 expect(candidate.headerOptions).toEqual([{rowIndex:1,headers:['대상','개입','예상값'],signature:['대상','개입','예상값'],recommended:true}]);
 expect(parseMappedRows(candidate.rows,candidate.sourceName,1,{name:0,quantity:1,unitPrice:2})[0]).toMatchObject({id:'import-0-0',name:'합성',quantity:2,unitPrice:100});
 for(const mapping of [{quantity:1},{name:0,quantity:0},{name:0,quantity:9},{name:0,arbitrary:1}])expect(()=>parseMappedRows(candidate.rows,'synthetic',1,mapping)).toThrow();
 expect(headerOptions([['품명','수량'],['합성','1']])[0].recommended).toBe(true);
});
it('rejects malformed/invalid/binary/formula-like inputs with bounded rows, columns, cells and bytes',()=>{
 for(const text of ['"unclosed','a"b,c','"a"x,b','=HYPERLINK("x"),1','@SUM,1','+CMD,1','-cmd|anything,1'])expect(()=>csvRows(text)).toThrow();
 expect(()=>decodeCsv(Uint8Array.from([0xff,0xff]))).toThrow();expect(()=>decodeCsv(bytes('a\0b'))).toThrow();
 expect(()=>decodeCsv(new Uint8Array(CSV_LIMITS.bytes+1))).toThrow();
 expect(()=>csvRows(Array(532).fill('a,b').join('\n'))).toThrow();expect(()=>csvRows(Array(257).fill('a').join(','))).toThrow();expect(()=>csvRows('a'.repeat(CSV_LIMITS.cell+1))).toThrow();
 expect(csvRows(Array(530).fill('a,b').join('\n'))).toHaveLength(530);
 const rows='품명,수량,단가\n'+Array(500).fill('합성,1,100').join('\n');expect(analyzeCsv(bytes(rows),'synthetic.csv').items).toHaveLength(500);expect(()=>analyzeCsv(bytes(rows+'\n합성,1,100'),'synthetic.csv')).toThrow();
 expect(()=>analyzeCsv(bytes('품명,수량,단가\n합성,999999999999999,99999999999'),'synthetic.csv')).toThrow();
});
it('preserves Rust invalid numeric and negative-rounding issue behavior without evaluating cells',()=>{
 const items=analyzeCsv(bytes('품명,수량,단가,금액\n합성,abc,-1,0\n합성2,-1,0.5,-1'),'synthetic.csv').items;
 expect(items[0].issues).toEqual(['invalidQuantity','invalidUnitPrice']);expect(items[1].issues).toEqual(['invalidQuantity']);
});
