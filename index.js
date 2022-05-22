const fetch = require("node-fetch");
const blessed = require("neo-blessed");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const screen = blessed.screen({
  autoPadding: true,
  smartCSR: true,
  dockBorders: true,
  title: "Green Flag!"
});

const scoringBox = blessed.box({
  width: "75%",
  height: "85%",
  top: "15%",
  left: "0%",
  border: {
    type: "line"
  },
  scrollable: true,
  scrollbar: true,
  keys: true,
  style: {
    scrollbar: {
      bg: "white",
      fg: "white"
    }
  }
});
screen.append(scoringBox);

const lapsBox = blessed.box({
  width: "25%",
  height: "15%",
  top: "0%",
  left: "75%",
  align: "center",
  valign: "middle",
  border: {
    type: "line"
  }
});
screen.append(lapsBox);

const eventBox = blessed.log({
  width: "75%",
  height: "15%",
  top: "0%",
  left: "0%",
  align: "center",
  valign: "middle",
  scrollOnInput: "true",
  border: {
    type: "line"
  }
});
screen.append(eventBox);

const notesBox = blessed.box({
  width: "25%",
  height: "85%",
  top: "15%",
  left: "75%",
  border: {
    type: "line"
  }
});
screen.append(notesBox);

screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

(async () => {
  const year = new Date().getFullYear()
  const schedules = {};
  schedules.trucks = await fetch(`https://www.nascar.com/cacher/${year}/3/race_list_basic.json`).then(res => res.json());
  schedules.xfinity = await fetch(`https://www.nascar.com/cacher/${year}/2/race_list_basic.json`).then(res => res.json());
  schedules.cup = await fetch(`https://www.nascar.com/cacher/${year}/1/race_list_basic.json`).then(res => res.json());
  schedules.array = [].concat(schedules.trucks, schedules.xfinity, schedules.cup);
  let seriesInfo = {};
  schedules.array.every(race => {
    const today = new Date();
    const raceDate = new Date(race.tunein_date);
    if (today.getDate() ==  raceDate.getDate() && today.getMonth() ==  raceDate.getMonth() && today.getFullYear() ==  raceDate.getFullYear()) {
      seriesInfo.found = true;
      seriesInfo.sid = race.series_id;
      seriesInfo.rid = race.race_id;
      if (!race.margin_of_victory) return false;
    }
    return true
  });

  if (!seriesInfo.found) {
    eventBox.setText("No race found for today");
    screen.render();
  } else {
    while (true) {
      const scoring = await fetch(`https://www.nascar.com/live/feeds/series_${seriesInfo.sid}/${seriesInfo.rid}/live_feed.json`).then(res => res.json());
      const racenotes = await fetch(`https://www.nascar.com/cacher/${year}/${seriesInfo.sid}/${seriesInfo.rid}/lap-notes.json`).then(res => res.json()).catch(err => {return {laps: {}}});
  
      eventBox.setText(`${scoring.run_name}\n${scoring.track_name}`);
  
      lapsBox.setText(`Lap ${scoring.lap_number < scoring.laps_in_race ? scoring.lap_number + 1 : scoring.lap_number} / ${scoring.laps_in_race}\n${scoring.laps_to_go} to go`);
      switch (scoring.flag_state) {
        case 1:
          lapsBox.style.bg = "green";
          lapsBox.style.fg = "black";
          break;
        case 2:
        case 8:
          lapsBox.style.bg = "yellow";
          lapsBox.style.fg = "black";
          break;
        case 3:
          lapsBox.style.bg = "red";
          lapsBox.style.fg = "white";
          break;
        case 5:
          lapsBox.style.bg = "white";
          lapsBox.style.fg = "black";
          break;
        default:
          lapsBox.style.bg = "black";
          lapsBox.style.fg = "white";
      }
  
      const drivers = scoring.vehicles.sort((a,b) => (a.running_position > b.running_position) ? 1 : -1);
      for (i=0;i<drivers.length;i++) {
        let delta;
        if (drivers[i].running_position == 1) delta = "Leader";
        else if (drivers[i].status == 2) delta = "Off";
        else if (drivers[i].status == 3) delta = "Out"; 
        else if (drivers[i].delta.toString().indexOf("-") != -1) delta = `${drivers[i].delta} lap${Math.abs(drivers[i].delta) == 1 ? "" : "s"}`;
        else delta = `-${drivers[i].delta}`;
        scoringBox.setLine(i, `${drivers[i].running_position.toString().padStart(2, " ")}.\t#${drivers[i].vehicle_number.toString().padEnd(2, " ")}\t${drivers[i].driver.full_name.replace(" #", "").replace("(i)", "").padEnd(40, " ")}\t${delta.padEnd(10, " ")}`);
      }

      var j = 0;
      for (const [lap, notes] of Object.entries(racenotes.laps)) {
        notesBox.setLine(j, `Lap ${lap}: ${notes[0].Note}\n`);
        j++;
      }
  
      screen.render();
      await sleep(5000);
    }
  }
})();