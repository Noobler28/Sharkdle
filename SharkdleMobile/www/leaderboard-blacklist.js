(function (root) {
    "use strict";

    // Firebase UIDs stay stable when usernames change. Keep the UID list in
    // firestore.rules in sync when adding or removing leaderboard restrictions.
    const entries = Object.freeze({
        sIoLtlm9kubExe2BY5cVvIlOqKA3: Object.freeze({ reason: "Automated Scripts" }),
        "1MPm8Ra9VYQusZkCBpRCRDo7nJq2": Object.freeze({ reason: "Cloned account data" }),
        "AtXSxyWxB0XTLVoB38EP9lXYY143": Object.freeze({ reason: "Cloned account data" }),
        "FhAoaY0rbGeuHaDdpxeAOUxj7Tz2": Object.freeze({ reason: "Cloned account data" }),
        "HqV0msSXj4MfRMxrZm5lcHijXSM2": Object.freeze({ reason: "Cloned account data" }),
        "L5Hq0ozcQobIMUs2PySv2lHt4eQ2": Object.freeze({ reason: "Cloned account data" }),
        "USfUIeFsBDbInpSqzuf9hF3ERSa2": Object.freeze({ reason: "Cloned account data" }),
        "Xv8ZMsmMKUZ29AfF8NlDuoc9nXR2": Object.freeze({ reason: "Cloned account data" }),
        "ef4NrLvi5mRWwNIAf9To9T2fxfH2": Object.freeze({ reason: "Cloned account data" }),
        "jkF9e0C2IlhuzcPR7kNfymLH9yu2": Object.freeze({ reason: "Cloned account data" }),
        "jsu9p9Yr2WVZxOlKn8QV1oPOQ972": Object.freeze({ reason: "Cloned account data" }),
        "pDjQ4iYMC7cwP6fIcCM70HhngR63": Object.freeze({ reason: "Cloned account data" }),
        "pQQ53hnSQpU45QbYO0uaU5VAlRm1": Object.freeze({ reason: "Cloned account data" }),
        "vhprPM4Hdghiz1Rpx3t2BX9bmap2": Object.freeze({ reason: "Offensive username" })
    });

    function getReason(uid) {
        return Object.prototype.hasOwnProperty.call(entries, uid) ? entries[uid].reason : null;
    }

    function isBlacklisted(...uids) {
        return uids.some((uid) => getReason(uid) !== null);
    }

    function isRecordBlacklisted(record, documentId = "") {
        return isBlacklisted(documentId, record?.uid, record?.userId, record?.leaderUid);
    }

    function getNotice(uid) {
        const reason = getReason(uid);
        return reason === null ? "" : `You have been blacklisted from the leaderboards. Reason: ${reason}. Your scores will not appear in rankings. You can still play and save your progress.`;
    }

    function renderNotice(container, authenticatedUid) {
        if (!container) return;
        const notice = getNotice(authenticatedUid);
        container.textContent = notice;
        container.hidden = !notice;
        container.style.display = notice ? "" : "none";
    }

    root.SharkdleLeaderboardBlacklist = Object.freeze({
        getReason, getNotice, isBlacklisted, isRecordBlacklisted, renderNotice
    });
})(window);
