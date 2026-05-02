{
  "rules": {
    "config": {
      ".read": "auth != null",
      ".write": "auth != null" 
    },
    "peserta": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["nama_lower", "kelas"]
    },
    "jadwal": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "soal": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "kunci": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "hasil": {
      ".read": "auth != null",
      "$resultKey": {
        ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)"
      },
      ".indexOn": ["examId", "userId"]
    },
    "online_status": {
      ".read": "auth != null",
      "$examId": {
        ".indexOn": ".value",
        "$userId": {
          ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)",
          ".validate": "newData.hasChildren(['last_seen', 'uid'])"
        }
      }
    },
    "pelanggaran": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["userId", "examId"]
    },
    "broadcasts": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "status_sync": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
