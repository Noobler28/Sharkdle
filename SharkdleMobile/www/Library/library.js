function getLibrarySearchTokens(searchTerm) {
    return String(searchTerm || "")
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function sharkMatchesLibrarySearch(shark, searchTerm, speciesNumber) {
    const tokens = getLibrarySearchTokens(searchTerm);
    if (!tokens.length) return true;

    const name = String(shark.name || "").toLowerCase();
    const family = String(shark.family || "").toLowerCase();
    const order = String(shark.order || "").toLowerCase();
    const genus = String(shark.genus || "").toLowerCase();
    const yod = shark.yod ? String(shark.yod).toLowerCase() : "";
    const archiveNumber = speciesNumber ? String(speciesNumber).toLowerCase() : "";

    const taxonomyFields = [genus, family, order];

    return tokens.every(token => {
        if (name.includes(token)) return true;
        if (archiveNumber && (archiveNumber === token || `#${archiveNumber}` === token)) return true;
        if (yod === token) return true;
        return taxonomyFields.some(field => field.includes(token));
    });
}

window.sharkMatchesLibrarySearch = sharkMatchesLibrarySearch;
