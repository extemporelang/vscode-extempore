// some basic sexpr helper code
// should rewrite this nicely :(

interface SexprResult {
    start: number;
    end: number;
    openings: number;
    closings: number;
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

let sexprString = (str: string, sexpr: SexprResult): string => {
    if ((sexpr.start === -1) && (sexpr.end === -1)) return "";
    return str.substring(
        (sexpr.start === -1) ? 0 : sexpr.start,
        (sexpr.end < 0) ? str.length : sexpr.end + 1);
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
            pos = open + 1;
        }
    }
    return { start: start, end: end, openings: numopen, closings: numclosed };
}

let topLevelSexpr = (strin: string, pos: number): SexprResult => {
    // if we're currently on an open paren, jump inside...
    if (strin[pos+1] === '(') {
        pos++;
    }
    let s = inSexpr(strin, pos);
    let s_expanded = expandSexpr(strin, s);
    while (!(s.start === s_expanded.start && s.end === s_expanded.end)) {
        s = s_expanded;
        s_expanded = expandSexpr(strin, s_expanded);
    }
    return s_expanded;
}

let findLastOpenParen = (strin: string): number => {
    let sexpr = inSexpr(strin, strin.length - 1);
    return sexpr.start;
}

// get whitespace count from the start of the 'line' that the sexpr starts on
// note that this is whitespace amount from the *start* of line
// (i.e. the sexpr start may not be the first sexpr to start on that line)
let lineIndentAmount = (strin: string, sexpr: SexprResult): number => {
    let lineStart = strin.lastIndexOf("\n", sexpr.start);
    let lineEnd = strin.indexOf("\n", sexpr.start);
    let lineStr = strin.substring(lineStart, lineEnd);
    let match = lineStr.match("^\\s*"); // indent on FIRST LINE
    let indent = (match.length) ? match[0].length - 1 : 0;
    return indent;
}

let sexprArgPos = (strin: string, sexpr: SexprResult): number => {
    let lineStart = strin.lastIndexOf("\n", sexpr.start);
    let lineEnd = strin.indexOf("\n", sexpr.start);
    let lineStr = strin.substring(lineStart, lineEnd);
    let name = sexprName(strin, sexpr);
    console.log("myname: " + name);
    let indent = lineStr.indexOf(name) + name.length;
    if (name.startsWith("(")) indent = indent - (name.length + 1);
    return indent;
}

let NamedIndentsShort = ["let", "define", "lambda", "bind-func", "letz"];

// indent amount
let sexprIndent = (strin: string, sexpr: SexprResult): number => {
    if (sexpr.start === -1 || sexpr.end !== -1) return 0; //indent;
    let name = sexprName(strin, sexpr);
    let shortIndent = (NamedIndentsShort.indexOf(name) > -1) ? true : false;
    let indent = lineIndentAmount(strin, sexpr);
    if (shortIndent) return indent + 2;
    return sexprArgPos(strin,sexpr);
}

export let xtmIndent = (strin: string): number => {
    let sexpr = inSexpr(strin, strin.length - 1);
    let indent = sexprIndent(strin, sexpr);
    let name = sexprName(strin, sexpr);
    //console.log("sexpr: " + JSON.stringify(sexpr));
    //console.log("name: " + name + "  indent: " + indent);
    //console.log("sexp-str: " + sexprString(strin, sexpr));
    return indent;
}

export let xtmInSexpr = inSexpr;
export let xtmTopLevelSexpr = topLevelSexpr;
export let xtmSexprToString = sexprString;
