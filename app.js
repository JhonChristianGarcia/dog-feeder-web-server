const express = require('express');
const app = express();
const { db } = require('./config');  // Import Firestore
const { collection, getDocs, onSnapshot, doc, getDoc, updateDoc } = require('firebase/firestore');

const schedule = require('node-schedule');
app.use(express.json());


const devicesRef = collection(db, "device-feeder");


getDocs(devicesRef)
    .then(snapshot => {
        snapshot.forEach(doc1 => {
            const currentDevice = doc(db, "device-feeder", doc1.id);
            onSnapshot(currentDevice, docSnapshot=> {
                if(docSnapshot.exists()){
                    const feedTimes = docSnapshot.data().feedTimes
                    const sortedFeedTimes =feedTimes.filter(t=> t > Date.now())
                    feedTimes?.forEach(time=> {
                        const date = new Date(time)
                        schedule.scheduleJob(date, () => {
                            updateDoc(currentDevice, {
                                motorOn: true
                            }).then(()=>{
                               setTimeout(()=>{
                                updateDoc(currentDevice, {
                                    motorOn: false,
                                    feedTimes: feedTimes?.length <= 1 ? feedTimes : feedTimes.filter(t=> t > Date.now())

                                })
                               },3000)  
                            })
                        });
                    })
                } else{
                    console.log(`No such document...`)
                }
            })
        });
    })
    .catch(error => {
        console.error("Error fetching documents: ", error);
    });




app.get("/", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "You've reached my server"
    });
});

// Example Firestore usage: Fetch data from a collection
app.get("/data", async (req, res) => {
    try {
        const colRef = collection(db, 'device_feeder'); // Use the collection function
        const querySnapshot = await getDocs(colRef);
        const data = querySnapshot.docs.map(doc => doc.data());
        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching data: ", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const date = new Date(1714635300000);
console.log(date);

schedule.scheduleJob(date, () => {
    console.log(`Job ran at ${date}`);
});

app.listen(3000, () => {
    console.log("App listening on port 3000...");
});