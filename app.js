const express = require('express');
const app = express();
const { db } = require('./config');  // Import Firestore
const { collection, getDocs, onSnapshot, doc, updateDoc } = require('firebase/firestore');
const cron = require('node-cron');
const moment = require('moment-timezone');
const schedule = require('node-schedule');
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
                    const serverTimeOffset = -8; // Server is 8 hours behind local time

                    feedTimes?.forEach(time => {
                        const localDate = moment(time);
                        const serverDate = localDate.clone().add(serverTimeOffset, 'hours');
                        schedule.scheduleJob(serverDate.toDate(), () => {
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
                        });
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

                        const localDate = moment().set({ hour: parseInt(hour), minute: parseInt(minute), second: parseInt(second) });
                        const serverDate = localDate.clone().add(-8, 'hours');
                        
                        const days = sched.repeat.map((day) => {
                            switch (day) {
                                case "Mon":
                                    return 1;
                                case "Tue":
                                    return 2;
                                case "Wed":
                                    return 3;
                                case "Thu":
                                    return 4;
                                case "Fri":
                                    return 5;
                                case "Sat":
                                    return 6;
                                case "Sun":
                                    return 0;
                                default:
                                    return "*";
                            }
                        });

                        const cronExpression = `0 ${serverDate.minute()} ${serverDate.hour()} * * ${days.join(',')}`;
                        cron.schedule(cronExpression, () => console.log("You're supposed to do something at this point!!"));
                        tasks[sched.id] = cron.schedule(cronExpression, () => {
                            console.log(`Motor updated`);
                            updatingDoc(currentDevice, sched.portion * 1000);
                        });
                    });
                }
            });
        });
    })
    .catch((error) => {
        console.error("Error fetching documents: ", error);
    });

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>My Node.js App</title>
  </head>
  <style>
  body {margin: 0;
    padding:0;
    display: flex;
    justify-content: center;
    align-items: center;}
  </style>
  
  <body>
      <h1>Welcome to My Node.js App</h1>
      <p>This is a simple HTML response sent from a Node.js server using Express.</p>
  </body>
  </html>
`);
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
