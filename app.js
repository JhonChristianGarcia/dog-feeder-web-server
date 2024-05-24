const express = require('express');
const app = express();
const { db } = require('./config');  // Import Firestore
const { collection, getDocs, onSnapshot, doc, updateDoc } = require('firebase/firestore');
const { CronJob } = require('cron');
const moment = require('moment-timezone');
const path = require('path')
app.use(express.json());

const devicesRef = collection(db, "device-feeder");

function updatingDoc(currentDevice, portion = 3000){
    updateDoc(currentDevice, {
        portion: portion / 1000
    }).then(() => {
        setTimeout(() => {
            updateDoc(currentDevice, {
                motorOn: true,
            })
        }, 3000);
    });
}

getDocs(devicesRef)
    .then(snapshot => {
        snapshot.forEach(doc1 => {
            const currentDevice = doc(db, "device-feeder", doc1.id);
            onSnapshot(currentDevice, docSnapshot => {
                if (docSnapshot.exists()) {
                    const feedTimes = docSnapshot.data().feedTimes;

                    feedTimes?.forEach(time => {
                        const localDate = moment.tz(time, 'Asia/Manila');  // Interpret time as PHT
                        const cronTime = `${localDate.seconds()} ${localDate.minutes()} ${localDate.hours()} ${localDate.date()} ${localDate.month() + 1} *`;

                        const job = new CronJob(cronTime, () => {
                            updateDoc(currentDevice, {
                                motorOn: true
                            }).then(() => {
                                setTimeout(() => {
                                    updateDoc(currentDevice, {
                                        motorOn: false,
                                        feedTimes: feedTimes?.length <= 1 ? feedTimes : feedTimes.filter(t => t > Date.now())
                                    });
                                }, 3000);
                            });
                        }, null, true, 'Asia/Manila');
                        
                        job.start();
                    });
                } else {
                    console.log(`No such document...`);
                }
            });
        });
    })
    .catch(error => {
        console.error("Error fetching documents: ", error);
    });

let tasks = {};

getDocs(devicesRef)
    .then((snapshot) => {
        snapshot.forEach((doc1) => {
            const currentDevice = doc(db, "device-feeder", doc1.id);
            onSnapshot(currentDevice, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const scheds = docSnapshot.data().reccuringSched;
                    if (scheds.length < 1) return;

                    scheds.forEach((sched) => {
                        if (tasks[sched.id]) {
                            tasks[sched.id].stop();
                            delete tasks[sched.id];
                        }

                        if (!sched.isOn) {
                            return;
                        }

                        let [hour, minute, second] = sched.time.split(":");
                        const period = second.slice(-2);
                        second = second.slice(0, -2);

                        if (period === 'PM' && hour !== '12') {
                            hour = parseInt(hour) + 12;
                        } else if (period === 'AM' && hour === '12') {
                            hour = '00';
                        }

                        const localDate = moment.tz({ hour: parseInt(hour), minute: parseInt(minute), second: parseInt(second) }, 'Asia/Manila');  // Interpret time as PHT
                        const cronTime = `${localDate.seconds()} ${localDate.minutes()} ${localDate.hours()} * * ${sched.repeat.map(day => {
                            switch (day) {
                                case "Mon": return 1;
                                case "Tue": return 2;
                                case "Wed": return 3;
                                case "Thu": return 4;
                                case "Fri": return 5;
                                case "Sat": return 6;
                                case "Sun": return 0;
                                default: return '*';
                            }
                        }).join(',')}`;

                        const job = new CronJob(cronTime, () => {
                            updatingDoc(currentDevice, sched.portion * 1000);
                        }, null, true, 'Asia/Manila');

                        job.start();
                        tasks[sched.id] = job;
                    });
                }
            });
        });
    })
    .catch((error) => {
        console.error("Error fetching documents: ", error);
    });

   

    app.use(express.static(path.join(__dirname, 'public')));

    app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, 'index.html'));
    });

app.get("/data", async (req, res) => {
    try {
        const colRef = collection(db, 'device_feeder');
        const querySnapshot = await getDocs(colRef);
        const data = querySnapshot.docs.map(doc => doc.data());
        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching data: ", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(3000, () => {
  console.log("App listening on port 3000...");
});
