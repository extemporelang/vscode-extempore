// some basic sexpr helper code
// should rewrite this nicely :(
/*
interface SexprResult {
    start: number;
    end: number;
    openings: number;
    closings: number;
    //name: string;
}

let sexprFindMatchingClose = (str: string, skipcnt: number, pos: number): number => {
    if (skipcnt === 0) return pos;
    let firstClose = str.indexOf(")", pos);
    if (firstClose === -1) return -1;
    return sexprFindMatchingClose(str, skipcnt - 1, firstClose+1);
}

// replace comments in string with ____
let sexprStripComments = (str: string): string => {
    let newstr = JSON.parse(JSON.stringify(str)); // rediculous copy???
    let matches = newstr.match(/(;.*)$/mg);
    if (matches) {
        for (var i = 0; i < matches.length; i++) {
            let repstr = '_'.repeat(matches[i].length);
            newstr = newstr.replace(matches[i], repstr);
        }
    }
    return newstr;
}

let expandSexpr = (strin: string, sexpr: SexprResult): SexprResult => {
    if (sexpr.start < 1) return sexpr; // can't be any further expansion 
    let newsexpr = inSexpr(strin, sexpr.start - 1);
    if (newsexpr.start > -1 && newsexpr.end > -1) {
        return expandSexpr(strin, newsexpr);
    } else {
        return sexpr;
    }
}

let sexprName = (str: string, sexpr: SexprResult): string => {
    if (sexpr.start < 0) return "";
    let exprcontents = str.substring(sexpr.start + 1, (sexpr.end < 0) ? str.length : sexpr.end);
    let name = exprcontents.match("^\\S*");
    return name[0];
}

let sexprArgPosition = (strin: string, sexpr: SexprResult): number => {
    if (sexpr.start < 0) return 0;
    let exprcontents = strin.substring(sexpr.start + 1, (sexpr.end < 0) ? strin.length : sexpr.end);
    let name = exprcontents.match("^\\S*\\s*");
    return name[0].length;
}

let sexprString = (str: string, sexpr: SexprResult): string => {
    if ((sexpr.start === -1) && (sexpr.end === -1)) return "";
    return str.substring(
        (testA.start === -1) ? 0 : testA.start,
        (testA.end === -1) ? teststr.length : testA.end + 1);  
}

let inSexpr = (strin: string, pos: number): SexprResult => {
    let str = sexprStripComments(strin);
    let start = -1;
    let idx = 1;
    // find start
    while (idx > 0) {
        start = str.lastIndexOf("(", pos);
        if (start === -1) break;
        let close = str.lastIndexOf(")", pos);
        if (close > start) {
            idx++;
            pos = close - 1;
        } else {
            idx--;
            pos = start - 1;
        }
    }
    pos = start + 1;
    let end = 0;
    let numclosed = 0;
    let numopen = (start < 0) ? 0 : 1;
    while (true) {
        let close = str.indexOf(")", pos);
        if (close < 0) {
            end = -1;
            break
        }
        let open = str.indexOf("(", pos);
        if (open < 0) open = strin.length;
        //console.log("TMPPOS: " + tmppos + " open:" + open + "  close:" + close);        
        if (close < open) {
            numclosed++;
            if (numopen === numclosed) {
                end = close;
                break;
            }
            pos = close + 1;
        }
        else {
            numopen++;
            pos = open + 1;// (open < close) ? open : close;
        }
    }
    return { start: start, end: end, openings: numopen, closings: numclosed };
}


let findLastOpenParen = (strin: string): number => {
    let sexpr = inSexpr(strin, strin.length - 1);
    console.log('s1: ' + JSON.stringify(sexpr), ' name: \"' + sexprName(strin, sexpr) + '\"');// strin.substring(sexpr.start, sexpr.end));
    return sexpr.start;
}

// get whitespace count from the start of the 'line' that the sexpr starts on
// note that this is whitespace amount from the *start* of line
// (i.e. the sexpr start may not be the first sexpr to start on that line)
let lineIndentAmount = (strin: string, sexpr: SexprResult): number => {
    let lineStart = strin.lastIndexOf("\n", sexpr.start);
    let lineEnd = strin.indexOf("\n", sexpr.start);
    let sexprStr = strin.substring(lineStart, lineEnd); 
    let match = sexprStr.match("^\\s*"); // indent on FIRST LINE
    let indent = (match.length) ? match[0].length : 0;
    return indent;
}

let NamedIndentsShort = ["let", "define", "lambda"];

// indent amount
let sexprIndent = (strin: string, sexpr: SexprResult): number => {
    let indent = lineIndentAmount(strin, sexpr);
    if (sexpr.start === -1 || sexpr.end !== -1) return indent;
    let name = sexprName(strin, sexpr);
    let shortIndent = (NamedIndentsShort.indexOf(name) > -1) ? true : false;
    if (shortIndent) return indent + 2;
    let argpos = sexprArgPosition(strin, sexpr);
    return indent + argpos;
}

let indent = (strin: string): number => {
    let sexpr = inSexpr(strin, strin.length);
    console.log("sexpr: " + JSON.stringify(sexpr));
    return sexprIndent(strin, sexpr);
}

*/